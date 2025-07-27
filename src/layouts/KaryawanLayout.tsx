import React from 'react';
import { Outlet } from 'react-router-dom';

const KaryawanLayout = () => {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Outlet />
    </div>
  );
};

export default KaryawanLayout;
