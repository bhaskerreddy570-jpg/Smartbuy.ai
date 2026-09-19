"use client";

import { useEffect, useState } from 'react';

type Profile = {
  email: string;
  name: string;
  phone: string;
  notifications: { email: boolean; push: boolean; inApp: boolean };
};

export function ProfileForm() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('');
  const [passwordStatus, setPasswordStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/account/profile')
      .then(async (r) => {
        if (!r.ok) throw new Error('Unable to load profile');
        return r.json();
      })
      .then((data) => {
        setProfile(data.profile);
        setName(data.profile.name);
        setPhone(data.profile.phone);
      })
      .catch(() => setStatus('Unable to load your profile.'))
      .finally(() => setLoading(false));
  }, []);

  async function saveProfile() {
    setStatus('');
    const response = await fetch('/api/account/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone }),
    });
    setStatus(response.ok ? 'Profile updated.' : 'Unable to update profile.');
  }

  async function changePassword(form: HTMLFormElement) {
    setPasswordStatus('');
    const data = new FormData(form);
    const response = await fetch('/api/account/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: data.get('currentPassword'),
        newPassword: data.get('newPassword'),
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setPasswordStatus(response.ok ? 'Password changed. Other sessions were signed out.' : (payload.error ?? 'Unable to change password.'));
    if (response.ok) form.reset();
  }

  if (loading) return <p>Loading profile...</p>;
  if (!profile) return <p>{status}</p>;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="font-semibold">Personal information</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm">Email</label>
            <input value={profile.email} disabled className="w-full rounded-xl border px-4 py-3 bg-zinc-100 dark:bg-zinc-900" />
            <p className="mt-1 text-xs text-zinc-500">Email changes require verification and are not changed directly.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border px-4 py-3" />
          </div>
          <div>
            <label className="mb-1 block text-sm">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-xl border px-4 py-3" autoComplete="tel" />
          </div>
          <button onClick={saveProfile} className="rounded-xl bg-zinc-900 px-4 py-3 font-medium text-white">Save profile</button>
          {status && <p className="text-sm text-zinc-600">{status}</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="font-semibold">Change password</h2>
        <form onSubmit={(e) => { e.preventDefault(); void changePassword(e.currentTarget); }} className="mt-4 space-y-4">
          <input name="currentPassword" type="password" minLength={8} required placeholder="Current password" className="w-full rounded-xl border px-4 py-3" autoComplete="current-password" />
          <input name="newPassword" type="password" minLength={8} required placeholder="New password" className="w-full rounded-xl border px-4 py-3" autoComplete="new-password" />
          <button className="rounded-xl bg-zinc-900 px-4 py-3 font-medium text-white">Change password</button>
          {passwordStatus && <p className="text-sm text-zinc-600">{passwordStatus}</p>}
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="font-semibold">Security sessions</h2>
        <p className="mt-2 text-sm text-zinc-500">Sessions are tracked for security and can be revoked from the account security API.</p>
      </section>
    </div>
  );
}
