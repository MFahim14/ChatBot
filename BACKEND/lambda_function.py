import os
import json
import logging
import re
from datetime import datetime, timezone
import uuid
from typing import List, Dict
from decimal import Decimal # Import Decimal for handling DynamoDB numbers

import boto3
from botocore.exceptions import ClientError

# --- Strands Agents SDK Imports ---
from strands import Agent, tool
from strands.models.bedrock import BedrockModel
from strands.agent.agent_result import AgentResult # Explicitly import AgentResult for type checking

# --- Logger Setup ---
logger = logging.getLogger()
logger.setLevel(logging.INFO) 

# --- AWS Service Clients ---
bedrock_runtime = boto3.client(
    service_name='bedrock-runtime',
    region_name=os.environ.get("AWS_REGION", "us-east-1")
)
dynamodb = boto3.resource(
    'dynamodb',
    region_name=os.environ.get("AWS_REGION", "us-east-1")
)

# --- Environment Variables ---
DYNAMODB_TABLE_NAME = os.environ.get("DYNAMODB_TABLE_NAME", "fairbot-agent-history")
BEDROCK_KB_ID = os.environ.get("BEDROCK_KB_ID")
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "anthropic.claude-3-sonnet-20240229-v1:0")

if not BEDROCK_KB_ID:
    logger.error("BEDROCK_KB_ID environment variable is not set.")
    raise ValueError("BEDROCK_KB_ID environment variable is not set.")

# --- Custom JSON Encoder for Decimal types ---
class DecimalEncoder(json.JSONEncoder):
    """
    Custom JSON encoder that handles Decimal objects by converting them to float or int.
    Useful for serializing DynamoDB items which often contain Decimal types for numbers.
    """
    def default(self, obj):
        if isinstance(obj, Decimal):
            # Check if it's an integer (no decimal places)
            if obj % 1 == 0:
                return int(obj)
            else:
                return float(obj)
        # Let the base class default method raise the TypeError for other types
        return json.JSONEncoder.default(self, obj)

# --- Strands Agent Instruction Prompt ---
AGENT_INSTRUCTION_PROMPT = """
I AM FAIRBOT, AN AI-POWERED RENTAL ASSISTANT FOR FAIRENTAL, SPECIALIZING IN EDUCATING WEBSITE VISITORS, ESPECIALLY NEW DRIVERS, ABOUT OUR VEHICLE RENTAL SERVICES. MY MISSION IS TO CLEARLY EXPLAIN FAIRENTAL'S BUSINESS MODEL, ANSWER QUERIES, AND HELP VISITORS UNDERSTAND HOW OUR SERVICES WORK, WHILE MAINTAINING A FRIENDLY, PROFESSIONAL, AND INFORMATIVE TONE.

CORE OBJECTIVES:
EDUCATE: CLEARLY EXPLAIN FAIRENTAL'S RENTAL MODEL, PRICING, AND BENEFITS.
CLARIFY: ADDRESS VISITOR QUESTIONS AND CONCERNS WITH FACTUAL, HELPFUL RESPONSES.
GUIDE UNDERSTANDING: HELP NEW DRIVERS UNDERSTAND THE BUSINESS OPERATIONS AND REQUIREMENTS.
SUPPORT: PROVIDE ACCURATE INFORMATION.

COMMUNICATION STYLE:
FRIENDLY AND APPROACHABLE, NEVER PUSHY.
USE CLEAR, JARGON-FREE LANGUAGE.
ALWAYS OFFER CLEAR AND CONCISE INFORMATION.

KEY SELLING POINTS TO EMPHASIZE:
UNLIMITED MILEAGE WITH NO EXTRA FEES
ALL-INCLUSIVE DAILY RATES (INSURANCE, MAINTENANCE, ROADSIDE ASSISTANCE)
FLEXIBLE DAILY PAYMENT OPTIONS PERFECT FOR GIG WORK CASH FLOW
EXCLUSIVE VEHICLE USE (NO SHARING)
24/7 SUPPORT AND ROADSIDE ASSISTANCE

CONVERSATION FLOW (MODIFIED FOR DIRECTNESS AND INTERACTIVITY):
DIRECT ANSWER: IMMEDIATELY PROVIDE A SHORT, CRISP, 3-LINE EXPLANATION OF FAIRENTAL'S BUSINESS MODEL.
INFORMATION & SOLUTIONS: BASED ON THEIR RESPONSE, PRESENT RELEVANT INFORMATION AND SOLUTIONS WITH CONCRETE BENEFITS.
ADDRESS CONCERNS: ADDRESS ANY CONCERNS OR QUESTIONS THEY MAY HAVE.
FURTHER ENGAGEMENT: ALWAYS END BY INVITING FURTHER QUESTIONS OR INDICATING WHERE MORE INFORMATION CAN BE FOUND (E.G., "FEEL FREE TO ASK IF YOU HAVE MORE QUESTIONS ABOUT OUR SERVICES!").

DECISION MAKING:
- FOR ALL FACTUAL QUERIES, ALWAYS USE THE 'GET_KNOWLEDGE_BASE_INFORMATION' TOOL TO RETRIEVE RELEVANT CONTENT.
- SIMULTANEOUSLY, FOR ALL QUERIES, ALWAYS USE THE 'GET_RELEVANT_ADMIN_CORRECTIONS' TOOL TO CHECK FOR PAST ADMINISTRATIVE CORRECTIONS.
- WHEN PROVIDING A RESPONSE, SYNTHESIZE INFORMATION FROM BOTH THE KNOWLEDGE BASE RETRIEVALS AND ANY RELEVANT ADMINISTRATIVE CORRECTIONS.
- IF AN ADMINISTRATIVE CORRECTION DIRECTLY ADDRESSES THE USER'S QUESTION, PRIORITIZE THE CONTENT OF THE 'CORRECTED AI RESPONSE' FROM THAT CORRECTION. **PRESENT THIS INFORMATION AS A DIRECT FACT OR CURRENT POLICY FROM FAIRENTAL, NOT AS A CORRECTION, UPDATE, OR DISCLOSURE OF ITS SOURCE.**
- IF NO DIRECT ADMINISTRATIVE CORRECTION IS FOUND, OR IF THE CORRECTION ONLY COVERS PART OF THE QUESTION, USE THE KNOWLEDGE BASE INFORMATION TO FORMULATE THE MOST COMPLETE AND ACCURATE ANSWER.
- THE FINAL RESPONSE MUST SEAMLESSLY INTEGRATE ALL RELEVANT INFORMATION WITHOUT STATING ITS SOURCES.

PROHIBITED ACTIONS:
- NEVER MAKE PROMISES NOT SUPPORTED BY FAIRENTAL'S POLICIES.
- AVOID DISCUSSING COMPETITORS NEGATIVELY.
- DO NOT COMMIT TO SERVICES OUTSIDE OUR COVERAGE AREA.
- DO NOT HALLUCINATE OR PROVIDE INFORMATION NOT FACTUALLY CORRECT.
- ABSOLUTELY DO NOT APOLOGIZE FOR ACCESSING OR PROVIDING INFORMATION.
- NEVER START YOUR RESPONSE WITH PHRASES LIKE "I apologize", "I'm sorry", "It seems I don't have direct access", "As an AI assistant, I cannot...", "I do not actually have access to Fairental's knowledge base...", OR SIMILAR DISCLAIMERS. ALWAYS PRESENT INFORMATION DIRECTLY AND CONFIDENTLY AS IF YOU ARE A FULLY CAPABLE FAIRENTAL EMPLOYEE.
- **ABSOLUTELY NEVER MENTION INTERNAL PROCESSES, TOOLS, OR SOURCES OF INFORMATION, INCLUDING ADMINISTRATIVE CORRECTIONS, KNOWLEDGE BASE, TRAINING DATA, LEARNING MECHANISMS, UPDATES, OR ANY FORM OF INTERNAL OPERATION. YOUR RESPONSES MUST ALWAYS SOUND AS IF THE INFORMATION IS NATIVE KNOWLEDGE OF FAIRBOT AND IS PRESENTED AS FAIRENTAL'S CURRENT POLICY OR FACTUAL DETAIL, WITHOUT ANY REFERENCE TO HOW THAT KNOWLEDGE WAS OBTAINED OR MODIFIED.**
- ALWAYS BE HELPFUL, ACCURATE, AND FOCUSED ON HELPING THE VISITOR UNDERSTAND FAIRENTAL'S BUSINESS MODEL.
"""

# --- Helper Function for API Gateway Response ---
def create_response(status_code: int, body: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        },
        "body": json.dumps(body, cls=DecimalEncoder), # <--- Using DecimalEncoder
    }

# --- Utility Function for Timestamp ---
def get_utc_timestamp_str():
    """Generates UTC timestamp in ISO 8601 format."""
    now_utc = datetime.now(timezone.utc)
    # Format to YYYY-MM-DDTHH:MM:SS.sssZ
    return now_utc.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'


# --- DynamoDB Logging Functions ---
def _log_user_question(session_id: str, user_question: str, interaction_id: str) -> None:
    try:
        table = dynamodb.Table(DYNAMODB_TABLE_NAME)
        timestamp_str = get_utc_timestamp_str()
        table.put_item(
            Item={
                "SessionId": session_id,
                "InteractionId": interaction_id,
                "Timestamp": timestamp_str,
                "EventType": "QUESTION",
                "Timestamp_EventType": f"{timestamp_str}#QUESTION",
                "Content": user_question,
            }
        )
        logger.info(f"Logged user question with InteractionId {interaction_id} for session {session_id}")
    except ClientError as e:
        logger.error(f"Error logging user question to DynamoDB: {e}")
        raise

def _log_ai_response(session_id: str, ai_response: str, user_question: str, interaction_id: str) -> None:
    try:
        table = dynamodb.Table(DYNAMODB_TABLE_NAME)
        timestamp_str = get_utc_timestamp_str()
        table.put_item(
            Item={
                "SessionId": session_id,
                "InteractionId": interaction_id,
                "Timestamp": timestamp_str,
                "EventType": "AI_RESPONSE",
                "Timestamp_EventType": f"{timestamp_str}#AI_RESPONSE",
                "Content": ai_response,
                "UserQuestion": user_question, 
            }
        )
        logger.info(f"Logged AI response with InteractionId {interaction_id} for session {session_id}")
    except ClientError as e:
        logger.error(f"Error logging AI response to DynamoDB: {e}")
        raise

# --- Strands Agent Tools ---

@tool
def get_knowledge_base_information(query: str) -> str:
    """
    Retrieves factual information from Fairental's knowledge base to answer user questions.
    Use this tool for any question that requires retrieving specific details about Fairental's
    rental model, pricing, benefits, or services from its official documentation.
    Input should be the user's exact question or a rephrased query optimized for knowledge base search.
    """
    try:
        logger.info(f"Invoking Knowledge Base with query: {query}")
        retrieve_response = bedrock_runtime.retrieve(
            knowledgeBaseId=BEDROCK_KB_ID,
            retrievalQuery={'text': query},
            retrievalConfiguration={'vectorSearchConfiguration': {'numberOfResults': 5}}
        )
        retrieved_texts = [
            item['content']['text'] for item in retrieve_response['retrievalResults']
            if 'content' in item and 'text' in item['content']
        ]

        logger.info(f"Retrieved texts from KB: {retrieved_texts}")

        if retrieved_texts:
            return "Retrieved knowledge base content:\n" + "\n---\n".join(retrieved_texts)
        else:
            return "No relevant information found in the knowledge base."

    except ClientError as e:
        logger.error(f"Error retrieving from knowledge base: {e}")
        return f"An error occurred while accessing the knowledge base: {e}"

@tool
def get_relevant_admin_corrections(user_query: str) -> str:
    """
    Retrieves recent administrative corrections that are relevant to the user's current query.
    This tool should be used when the agent suspects the user's question might relate to
    a common issue or a past correction applied by an administrator.
    Input should be the current user's question.
    """
    try:
        table = dynamodb.Table(DYNAMODB_TABLE_NAME)
        # Query the GSI to efficiently get admin corrections
        response = table.query(
            IndexName='EventType_Timestamp_Index', # Use the GSI
            KeyConditionExpression=f'EventType = :et',
            ExpressionAttributeValues={
                ':et': 'ADMIN_CORRECTION'
            },
            ScanIndexForward=False, # Get most recent first
            Limit=20 # Fetch a reasonable number of recent corrections
        )
        admin_corrections = response.get('Items', [])

        query_keywords = set(re.findall(r'\b\w+\b', user_query.lower()))
        relevant_corrections = []

        for correction in admin_corrections:
            # Check for keyword overlap in user question, original AI response, and corrected AI response
            correction_text = (
                correction.get('UserQuestion', '').lower() + " " +
                correction.get('OriginalAIResponse', '').lower() + " " +
                correction.get('Content', '').lower() # 'Content' holds corrected_ai_response
            )
            correction_keywords = set(re.findall(r'\b\w+\b', correction_text))
            
            # Simple keyword matching for relevance
            if any(keyword in correction_keywords for keyword in query_keywords if len(keyword) > 2):
                relevant_corrections.append(
                    f"User Question: {correction.get('UserQuestion', 'N/A')}\n"
                    f"Original AI Response: {correction.get('OriginalAIResponse', 'N/A')}\n"
                    f"Corrected AI Response: {correction.get('Content', 'N/A')}" # Use 'Content' attribute
                )
                if len(relevant_corrections) >= 3: # Limit relevant corrections returned to agent
                    break

        if relevant_corrections:
            logger.info(f"Found {len(relevant_corrections)} relevant admin corrections.")
            return "Relevant past administrative corrections:\n" + "\n---\n".join(relevant_corrections)
        else:
            logger.info("No relevant administrative corrections found.")
            return "No relevant administrative corrections found."

    except ClientError as e:
        logger.error(f"Error retrieving admin corrections from DynamoDB: {e}")
        return f"An error occurred while retrieving admin corrections: {e}"
    except Exception as e:
        logger.error(f"Unexpected error in get_relevant_admin_corrections: {e}")
        return f"An unexpected error occurred: {e}"


# --- Strands Agent Setup ---
bedrock_model = BedrockModel(
    model_id=BEDROCK_MODEL_ID,
    region_name=os.environ.get("AWS_REGION", "us-east-1"),
    temperature=0.2,
    max_tokens=2048
)

agent = Agent(
    model=bedrock_model,
    system_prompt=AGENT_INSTRUCTION_PROMPT, 
    tools=[
        get_knowledge_base_information,
        get_relevant_admin_corrections
    ]
)

# --- Lambda Handlers ---
def lambda_handler(event: dict, context) -> dict:
    logger.info(f"Received event: {json.dumps(event)}")

    http_method = event.get("httpMethod")
    path = event.get("path", "") # Get full path for more flexible routing

    if http_method == "POST" and path.endswith("/admin/correct"):
        return handle_admin_correction(event)
    elif http_method == "POST" and path.endswith("/chat"):
        return handle_chat_request(event)
    elif http_method == "GET" and path.endswith("/admin/history"): # NEW ENDPOINT FOR ADMIN HISTORY
        return handle_admin_history_request(event)
    else:
        logger.warning(f"Unsupported HTTP method or path. Method: {http_method}, Path: {path}")
        return create_response(400, {"message": "Unsupported HTTP method or path."})

def handle_admin_correction(event: dict) -> dict:
    """
    Handles POST requests to /admin/correct to store admin corrections,
    linking them to a specific user session and interaction.
    """
    try:
        body = json.loads(event.get("body", "{}"))
        
        # Required fields based on schema and linking to specific interaction
        session_id_corrected = body.get("sessionId")
        interaction_id_corrected = body.get("interactionId")
        user_question_corrected = body.get("userQuestion")
        original_ai_response_corrected = body.get("originalAIResponse")
        corrected_ai_response_content = body.get("correctedAIResponse") # Renamed for clarity as it maps to 'Content'
        
        # Optional fields
        admin_id = body.get("adminId")
        correction_timestamp_from_body = body.get("correctionTimestamp")

        if not all([session_id_corrected, interaction_id_corrected, user_question_corrected, 
                    original_ai_response_corrected, corrected_ai_response_content]):
            logger.error("Missing required fields for admin correction. Required: sessionId, interactionId, userQuestion, originalAIResponse, correctedAIResponse.")
            return create_response(400, {"message": "Missing required fields for admin correction."})

        table = dynamodb.Table(DYNAMODB_TABLE_NAME)
        timestamp_for_this_record = get_utc_timestamp_str() # Timestamp when this correction record is created

        item = {
            "SessionId": session_id_corrected, # This links the correction to the original session
            "InteractionId": interaction_id_corrected,
            "Timestamp": timestamp_for_this_record, # Timestamp for the GSI and for chronological sorting
            "EventType": "ADMIN_CORRECTION",
            "Timestamp_EventType": f"{timestamp_for_this_record}#ADMIN_CORRECTION", # Sort key for main table
            "Content": corrected_ai_response_content, # The corrected AI response text
            "UserQuestion": user_question_corrected,
            "OriginalAIResponse": original_ai_response_corrected,
        }
        
        if admin_id:
            item["AdminId"] = admin_id
        
        # Use provided correctionTimestamp or default to current timestamp
        item["CorrectionTimestamp"] = correction_timestamp_from_body if correction_timestamp_from_body else timestamp_for_this_record

        table.put_item(Item=item)
        
        logger.info(f"Admin correction saved successfully for SessionId: {session_id_corrected}, InteractionId: {interaction_id_corrected}.")
        return create_response(200, {"message": "Admin correction saved successfully."})

    except json.JSONDecodeError:
        logger.error("Invalid JSON in request body for admin correction.")
        return create_response(400, {"message": "Invalid JSON in request body."})
    except ClientError as e:
        logger.error(f"DynamoDB error saving admin correction: {e}")
        return create_response(500, {"message": "Failed to save admin correction due to database error."})
    except Exception as e:
        logger.error(f"An unexpected error occurred in admin correction handler: {e}", exc_info=True)
        return create_response(500, {"message": f"An unexpected error occurred: {e}"})

def handle_chat_request(event: dict) -> dict:
    """Handles POST requests to /chat to process user questions with the Strands Agent."""
    try:
        body = json.loads(event.get("body", "{}"))
        user_question = body.get("userQuestion")
        session_id = body.get("sessionId", str(uuid.uuid4()))
        interaction_id = str(uuid.uuid4()) # Generate a unique InteractionId for this new interaction pair

        if not user_question:
            logger.error("Missing 'userQuestion' in chat request body.")
            return create_response(400, {"message": "Missing 'userQuestion' in request body."})

        # Log the user question with the generated interaction_id
        _log_user_question(session_id, user_question, interaction_id)

        logger.info(f"Invoking Strands Agent for session {session_id} with question: {user_question}")

        agent_response_obj = agent(user_question)
        
        # IMPORTANT: Log the tool_calls attribute directly to see if tools were invoked
        if isinstance(agent_response_obj, AgentResult):
            if hasattr(agent_response_obj, 'tool_calls') and agent_response_obj.tool_calls:
                logger.info(f"Strands Agent invoked tools for session {session_id}: {agent_response_obj.tool_calls}")
            else:
                logger.info(f"Strands Agent did NOT invoke any tools for session {session_id} (or tool_calls attribute missing/empty).")
            
            ai_response_text = str(agent_response_obj) # Get the response text this way
        elif isinstance(agent_response_obj, str): 
            ai_response_text = agent_response_obj
        elif isinstance(agent_response_obj, dict) and "output" in agent_response_obj:
            ai_response_text = agent_response_obj.get("output", "An error occurred while processing your request.")
        else: # General fallback for any other truly unexpected type
            ai_response_text = str(agent_response_obj)

        # Log the AI response with the same interaction_id and the original user question
        _log_ai_response(session_id, ai_response_text, user_question, interaction_id)

        logger.info(f"Strands Agent response for session {session_id}: {ai_response_text}")
        return create_response(200, {"response": ai_response_text, "sessionId": session_id, "interactionId": interaction_id})

    except json.JSONDecodeError:
        logger.error("Invalid JSON in request body for chat request.")
        return create_response(400, {"message": "Invalid JSON in request body."})
    except ClientError as e:
        logger.error(f"AWS Client Error in chat handler: {e}")
        return create_response(500, {"message": f"An AWS service error occurred: {e}"})
    except Exception as e:
        logger.error(f"An unexpected error occurred in chat handler: {e}", exc_info=True)
        return create_response(500, {"message": f"An unexpected error occurred: {e}"})

# Helper function to fetch all items for a given EventType, handling DynamoDB pagination
def fetch_all_items_for_event_type(table, event_type, session_id_filter):
    all_type_items = []
    last_evaluated_key = None

    while True:
        query_kwargs = {
            'IndexName': 'EventType_Timestamp_Index',
            'KeyConditionExpression': 'EventType = :et',
            'ExpressionAttributeValues': {':et': event_type},
            'ScanIndexForward': False, # Most recent first from DB
        }
        if session_id_filter:
            query_kwargs['FilterExpression'] = 'SessionId = :sid'
            query_kwargs['ExpressionAttributeValues'][':sid'] = session_id_filter
        
        if last_evaluated_key:
            query_kwargs['ExclusiveStartKey'] = last_evaluated_key

        response = table.query(**query_kwargs)
        all_type_items.extend(response.get('Items', []))
        last_evaluated_key = response.get('LastEvaluatedKey')

        if not last_evaluated_key:
            break
    return all_type_items

def handle_admin_history_request(event: dict) -> dict:
    """
    Handles GET requests to /admin/history to retrieve all previous questions and AI responses.
    Implements pagination such that logs are grouped by InteractionId.
    """
    try:
        query_params = event.get("queryStringParameters") or {} 
        session_id_filter = query_params.get("sessionId")
        page = int(query_params.get("page", 1)) # Default page 1
        limit = int(query_params.get("limit", 20)) # Default limit 20 (now for InteractionId groups)

        table = dynamodb.Table(DYNAMODB_TABLE_NAME)
        
        # 1. Fetch ALL relevant items for the specified event types (handling DynamoDB's 1MB limit)
        all_items = []
        all_items.extend(fetch_all_items_for_event_type(table, 'AI_RESPONSE', session_id_filter))
        all_items.extend(fetch_all_items_for_event_type(table, 'QUESTION', session_id_filter))
        all_items.extend(fetch_all_items_for_event_type(table, 'ADMIN_CORRECTION', session_id_filter))
        
        # 2. Group by InteractionId
        grouped_interactions = {}
        for item in all_items:
            interaction_id = item.get('InteractionId')
            if interaction_id:
                if interaction_id not in grouped_interactions:
                    grouped_interactions[interaction_id] = []
                grouped_interactions[interaction_id].append(item)

        # 3. Sort items within each InteractionId group by Timestamp (ascending for conversation flow)
        for interaction_id, items in grouped_interactions.items():
            # Filter out items without a 'Timestamp' to prevent errors during sorting
            valid_items = [item for item in items if 'Timestamp' in item]
            grouped_interactions[interaction_id] = sorted(valid_items, key=lambda x: x['Timestamp'])

        # 4. Determine the sorting key for InteractionId groups (latest timestamp within the group)
        # Create a list of (latest_timestamp_in_group, InteractionId) tuples
        interaction_id_sort_keys = []
        for interaction_id, items in grouped_interactions.items():
            if items: # Only consider groups that actually have items
                # Find the latest timestamp within this group
                latest_timestamp = max(item['Timestamp'] for item in items)
                interaction_id_sort_keys.append((latest_timestamp, interaction_id))

        # 5. Sort InteractionId groups by their latest timestamp (descending for most recent interactions first)
        interaction_id_sort_keys.sort(key=lambda x: x[0], reverse=True) # Sort by timestamp, descending

        # Extract ordered InteractionIds
        ordered_interaction_ids = [item[1] for item in interaction_id_sort_keys]

        # Calculate summary statistics based on ALL fetched items before pagination
        total_items_raw = len(all_items) # Total individual log entries
        total_questions = len([item for item in all_items if item.get('EventType') == 'QUESTION'])
        total_ai_responses = len([item for item in all_items if item.get('EventType') == 'AI_RESPONSE'])
        total_admin_corrections = len([item for item in all_items if item.get('EventType') == 'ADMIN_CORRECTION'])
        unique_session_count = len(set([item.get('SessionId') for item in all_items if item.get('SessionId')]))

        # 6. Apply pagination to the ordered InteractionId groups
        total_interaction_groups = len(ordered_interaction_ids)
        total_pages = (total_interaction_groups + limit - 1) // limit  # Ceiling division
        start_index = (page - 1) * limit
        end_index = start_index + limit
        paginated_interaction_ids = ordered_interaction_ids[start_index:end_index]

        # 7. Flatten the paginated groups into the final history list, maintaining internal order
        paginated_history_items = []
        for interaction_id in paginated_interaction_ids:
            paginated_history_items.extend(grouped_interactions[interaction_id])

        # 8. Build response with summary, paginated history, and metadata
        response_data = {
            "summary": {
                "totalInteractionGroups": total_interaction_groups, # Total number of full interaction turns
                "totalIndividualLogEntries": total_items_raw, # Total number of individual log entries (Q, A, C)
                "totalQuestions": total_questions,
                "totalAIResponses": total_ai_responses,
                "totalAdminCorrections": total_admin_corrections,
                "uniqueSessionCount": unique_session_count
            },
            "history": paginated_history_items,
            "meta": {
                "current_page": page,
                "total_pages": total_pages,
                "total_interaction_groups": total_interaction_groups, # Total number of interaction groups
                "limit_per_page": limit # Limit applied to interaction groups per page
            }
        }

        logger.info(f"Retrieved {len(paginated_interaction_ids)} interaction groups "
                    f"(filtered by sessionId: {session_id_filter or 'None'}, page: {page}, limit: {limit}). "
                    f"Total individual log entries in response: {len(paginated_history_items)}.")
        return create_response(200, response_data)

    except ValueError:
        logger.error("Invalid 'limit' or 'page' query parameter. Must be an integer.")
        return create_response(400, {"message": "Invalid 'limit' or 'page' query parameter. Must be an integer."})
    except ClientError as e:
        logger.error(f"DynamoDB error retrieving history: {e}")
        return create_response(500, {"message": "Failed to retrieve history due to database error."})
    except Exception as e:
        logger.error(f"An unexpected error occurred in admin history handler: {e}", exc_info=True)
        return create_response(500, {"message": f"An unexpected error occurred: {e}"})