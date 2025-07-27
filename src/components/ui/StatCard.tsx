import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  color: 'blue' | 'green' | 'orange' | 'red';
  footer?: string;
}

const StatCard = ({ icon: Icon, title, value, color, footer }: StatCardProps) => {
  const colors = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', gradient: 'bg-gradient-to-r from-blue-600 to-blue-700' },
    green: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', gradient: 'bg-gradient-to-r from-green-500 to-emerald-600' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', gradient: 'bg-gradient-to-r from-orange-500 to-amber-600' },
    red: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', gradient: 'bg-gradient-to-r from-red-500 to-rose-600' },
  };
  const selectedColor = colors[color] || colors.blue;

  return (
    <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-5 border border-gray-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
      <div className="flex items-center">
        <div className={`w-10 h-10 sm:w-12 sm:h-12 ${selectedColor.bg} ${selectedColor.border} rounded-xl flex items-center justify-center`}>
          <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${selectedColor.text}`} />
        </div>
        <div className="ml-3 sm:ml-4">
          <p className="text-xs sm:text-sm font-medium text-gray-600">{title}</p>
          <p className="text-lg sm:text-2xl font-bold text-gray-900">{value}</p>
          {footer && <p className={`text-xs ${selectedColor.text}`}>{footer}</p>}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
