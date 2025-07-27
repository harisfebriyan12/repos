import React from 'react';
import { Info, ExternalLink } from 'lucide-react';

const RecaptchaInfo = () => {
  return (
    <div className="mt-4 p-4 bg-blue-50 rounded-lg">
      <div className="flex items-start space-x-3">
        <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
       </div>
    </div>
  );
};

export default RecaptchaInfo;