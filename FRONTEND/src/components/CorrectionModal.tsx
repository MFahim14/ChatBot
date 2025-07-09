
import React, { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { chatApi } from '@/utils/api';
import { ChatHistory, AdminCorrectionRequest } from '@/types/api';
import { useToast } from '@/hooks/use-toast';

interface CorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  interaction: ChatHistory;
  onSuccess: () => void;
}

const CorrectionModal: React.FC<CorrectionModalProps> = ({
  isOpen,
  onClose,
  interaction,
  onSuccess,
}) => {
  const [correctedResponse, setCorrectedResponse] = useState('');
  const [adminId, setAdminId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!correctedResponse.trim()) {
      setError('Please provide a corrected response');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const correctionData: AdminCorrectionRequest = {
        sessionId: interaction.sessionId,
        interactionId: interaction.interactionId,
        userQuestion: interaction.userQuestion,
        originalAIResponse: interaction.aiResponse,
        correctedAIResponse: correctedResponse.trim(),
        adminId: adminId.trim() || undefined,
        correctionTimestamp: new Date().toISOString(),
      };

      await chatApi.submitCorrection(correctionData);
      
      toast({
        title: "Success",
        description: "Correction submitted successfully!",
      });
      
      onSuccess();
      handleClose();
      
    } catch (error) {
      console.error('Correction submission error:', error);
      setError(error instanceof Error ? error.message : 'Failed to submit correction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCorrectedResponse('');
    setAdminId('');
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            Correct AI Response
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Interaction Metadata */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <Label className="text-xs font-medium text-gray-600">Session ID</Label>
              <Badge variant="outline" className="mt-1">
                {interaction.sessionId}
              </Badge>
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-600">Interaction ID</Label>
              <Badge variant="outline" className="mt-1">
                {interaction.interactionId}
              </Badge>
            </div>
          </div>

          {/* Original User Question */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">User Question (Read-only)</Label>
            <div className="p-3 bg-blue-50 border rounded-md">
              <p className="text-sm">{interaction.userQuestion}</p>
            </div>
          </div>

          {/* Original AI Response */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Original AI Response (Read-only)</Label>
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm">{interaction.aiResponse}</p>
            </div>
          </div>

          {/* Corrected Response */}
          <div className="space-y-2">
            <Label htmlFor="corrected-response" className="text-sm font-medium required">
              Corrected AI Response *
            </Label>
            <Textarea
              id="corrected-response"
              value={correctedResponse}
              onChange={(e) => setCorrectedResponse(e.target.value)}
              placeholder="Enter the improved response that the AI should have provided..."
              rows={6}
              className="resize-none"
              required
            />
            <p className="text-xs text-gray-500">
              Provide the corrected response that will be used to improve the AI's future performance.
            </p>
          </div>

          {/* Admin ID */}
          <div className="space-y-2">
            <Label htmlFor="admin-id" className="text-sm font-medium">Admin ID (Optional)</Label>
            <Input
              id="admin-id"
              value={adminId}
              onChange={(e) => setAdminId(e.target.value)}
              placeholder="Enter your admin identifier (e.g., john_doe)"
              className="max-w-md"
            />
          </div>

          {/* Timestamp Display */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Correction Timestamp</Label>
            <div className="p-2 bg-gray-50 border rounded text-sm text-gray-600">
              {new Date().toLocaleString()} (Auto-generated)
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !correctedResponse.trim()}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Submitting...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Submit Correction
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CorrectionModal;
