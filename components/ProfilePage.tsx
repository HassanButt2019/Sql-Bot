import React, { useState } from 'react';
import { updateProfile } from '../services/authService';

interface ProfilePageProps {
  user: { email?: string; name?: string; company?: string; role?: string };
  onUpdate: (user: any) => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ user, onUpdate }) => {
  const [form, setForm] = useState({
    name: user?.name || '',
    company: user?.company || '',
    role: user?.role || ''
  });
  const [status, setStatus] = useState<string | null>(null);

  const handleSave = async () => {
    setStatus(null);
    try {
      const result = await updateProfile(form);
      if (!result.success) {
        throw new Error(result.error || 'Failed to update profile.');
      }
      if (result.data?.user) {
        onUpdate(result.data.user);
      }
      setStatus('Profile updated.');
    } catch (err: any) {
      setStatus(err?.message || 'Failed to update profile.');
    }
  };

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="bg-white w-full rounded-[3rem] shadow-2xl border border-slate-200 overflow-hidden min-h-[70vh]">
        <div className="flex flex-col min-w-0 overflow-hidden">
          <div className="px-10 pt-8 pb-4">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Profile Settings</h3>
            <p className="text-xs text-slate-500 font-medium">Manage your account information.</p>
          </div>
          <div className="flex-1 px-10 pb-10 grid grid-cols-12 gap-8">
            <div className="col-span-12 lg:col-span-6 bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Email</label>
                <input
                  value={user?.email || ''}
                  disabled
                  className="w-full mt-1 p-4 rounded-2xl border border-slate-200 text-sm bg-slate-100 text-slate-500"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full mt-1 p-4 rounded-2xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Company</label>
                <input
                  value={form.company}
                  onChange={(e) => setForm(prev => ({ ...prev, company: e.target.value }))}
                  className="w-full mt-1 p-4 rounded-2xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Role</label>
                <input
                  value={form.role}
                  onChange={(e) => setForm(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full mt-1 p-4 rounded-2xl border border-slate-200 text-sm"
                />
              </div>
              {status && <div className="text-xs text-slate-600">{status}</div>}
              <button
                onClick={handleSave}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-black"
              >
                Save Profile
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
