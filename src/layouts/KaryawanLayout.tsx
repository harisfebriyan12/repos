import React from 'react';
import { Outlet } from 'react-router-dom';
import ThemeSwitcher from '../components/ThemeSwitcher';

const KaryawanLayout = () => {
  return (
        <div className="p-4">
            <div className="flex justify-end">
                <ThemeSwitcher />
            </div>
            <Outlet />
        </div>
  );
};

export default KaryawanLayout;
