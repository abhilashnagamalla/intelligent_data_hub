import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../../api';

export default function FeedbackModal({ isOpen, onClose, onConfirmLogout }) {
  const { t } = useTranslation();
  const [ratings, setRatings] = useState({
    overall: 0,
    usability: 0,
    features: 0,
    performance: 0,
  });
  const [comments, setComments] = useState('');
  const [hoveredRating, setHoveredRating] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const questions = [
    { id: 'overall', label: t('Overall Experience') || 'Overall Experience' },
    { id: 'usability', label: t('Ease of Use') || 'Ease of Use' },
    { id: 'features', label: t('Features Quality') || 'Features Quality' },
    { id: 'performance', label: t('Performance') || 'Performance' },
  ];

  const handleSubmitFeedback = async () => {
    setError('');
    setIsSubmitting(true);
    
    try {
      const feedbackData = {
        ratings,
        comments,
        timestamp: new Date().toISOString(),
      };
      
      // Send feedback to backend
      await api.post('/feedback', feedbackData);
      
      // Proceed with logout
      onConfirmLogout(true);
      onClose();
    } catch (err) {
      setError(t('Failed to submit feedback. Logging out anyway...') || 'Failed to submit feedback. Logging out anyway...');
      // Still logout even if feedback submission fails
      setTimeout(() => {
        onConfirmLogout(true);
        onClose();
      }, 1500);
    }
    
    setIsSubmitting(false);
  };

  const handleSkipFeedback = () => {
    onConfirmLogout(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border-2 border-black bg-white dark:bg-gray-950 shadow-2xl p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
                {t('We value your feedback') || 'We value your feedback'}
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('Your feedback helps us improve. This is optional.') || 'Your feedback helps us improve. This is optional.'}
            </p>

            {/* Ratings */}
            <div className="space-y-4 mb-6">
              {questions.map(({ id, label }) => (
                <div key={id}>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {label}
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRatings({ ...ratings, [id]: star })}
                        onMouseEnter={() => setHoveredRating({ ...hoveredRating, [id]: star })}
                        onMouseLeave={() => setHoveredRating({ ...hoveredRating, [id]: 0 })}
                        className="transition-transform hover:scale-110"
                      >
                        <Star
                          className={`w-6 h-6 transition-colors ${
                            (hoveredRating[id] || ratings[id]) >= star
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300 dark:text-gray-600'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Comments */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {t('Additional Comments (Optional)') || 'Additional Comments (Optional)'}
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder={t('Share any thoughts or suggestions...') || 'Share any thoughts or suggestions...'}
                className="w-full rounded-2xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-4 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:border-black dark:focus:border-white transition-colors resize-none"
                rows="4"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-700/50 text-red-700 dark:text-red-300 text-sm">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleSkipFeedback}
                disabled={isSubmitting}
                className="px-6 py-3 rounded-2xl border-2 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('Logout without Feedback') || 'Logout without Feedback'}
              </button>
              <button
                type="button"
                onClick={handleSubmitFeedback}
                disabled={isSubmitting}
                className="px-6 py-3 rounded-2xl border-2 border-black bg-black text-white font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? t('Submitting...') || 'Submitting...' : t('Submit & Logout') || 'Submit & Logout'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
