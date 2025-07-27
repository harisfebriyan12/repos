export interface User {
  id: string;
  email?: string;
  // Add any other user properties here
}

export interface Profile {
  id: string;
  name: string;
  role: 'admin' | 'karyawan';
  // Add any other profile properties here
}
