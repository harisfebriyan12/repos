import React from 'react';
import { Outlet } from 'react-router-dom';
import ThemeSwitcher from '../components/ThemeSwitcher';

const KaryawanLayout = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 flex flex-col">
        <div className="p-4">
            <div className="flex justify-end">
                <ThemeSwitcher />
            </div>
            <Outlet />
        </div>
    </div>
  );
};

export default KaryawanLayout;
