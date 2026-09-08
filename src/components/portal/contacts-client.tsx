"use client";

import { useMemo, useState } from "react";

type ContactRecord = {
  id: string;
  displayName: string | null;
  payload: {
    phones: Array<{ value: string; label?: string }>;
    emails: Array<{ value: string; label?: string }>;
    organization?: string;
  };
  syncVersion: string;
  updatedAt: string;
};

type DeviceRecord = {
  id: string;
  platform: "ANDROID" | "IOS";
  displayName: string;
  automaticBackupEnabled: boolean;
  lastSeenAt: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  revokedAt: string | null;
};

type ContactsPayload = {
  summary: {
    automaticBackupEnabled: boolean;
    contactCount: number;
    contactStorageBytes: string;
    lastSuccessfulBackupAt: string | null;
    lastSyncStatus: string | null;
    lastSyncError: string | null;
  };
  devices: DeviceRecord[];
  contacts: ContactRecord[];
};

export function ContactsClient({
  initialData,
}: {
  initialData: ContactsPayload;
}) {
  const [data, setData] = useState<ContactsPayload>(initialData);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh(search?: string) {
    setError(null);
    const response = await fetch(
      `/api/contacts${search ? `?q=${encodeURIComponent(search)}` : ""}`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      setError("Unable to load contacts backup");
      return;
    }

    setData((await response.json()) as ContactsPayload);
  }

  const filteredContacts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return data.contacts;
    }
    return data.contacts.filter((contact) =>
      `${contact.displayName ?? ""} ${JSON.stringify(contact.payload)}`.toLowerCase().includes(needle),
    );
  }, [data, query]);

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/contacts/export");
      if (!response.ok) {
        throw new Error("export failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "cloudstorenow-contacts.vcf";
      link.click();
      URL.revokeObjectURL(url);
      setMessage("Contacts exported as VCF");
    } catch {
      setError("Unable to export contacts");
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/contacts/import", {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json().catch(() => null)) as {
      imported?: number;
      error?: string;
    } | null;

    if (!response.ok) {
      setError(payload?.error === "STORAGE_QUOTA_EXCEEDED" ? "Storage quota exceeded" : "Unable to import VCF");
      setBusy(false);
      return;
    }

    setMessage(`${payload?.imported ?? 0} contact(s) imported from VCF`);
    await refresh(query);
    setBusy(false);
  }

  async function revokeDevice(deviceId: string, name: string) {
    if (!window.confirm(`Revoke ${name}? It will stop syncing until you sign in again.`)) {
      return;
    }

    const response = await fetch(`/api/contacts/devices/${deviceId}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Unable to revoke device");
      return;
    }

    setMessage(`${name} revoked`);
    await refresh(query);
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      <div className="portal-page-header">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Contacts</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Automatic mobile backup status and backed-up contact records.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="portal-secondary-button" disabled={busy} onClick={() => void handleExport()}>
            Export VCF
          </button>
          <label className="portal-primary-button cursor-pointer">
            Import VCF
            <input type="file" accept=".vcf,.vcard,text/vcard" className="hidden" disabled={busy} onChange={(event) => void handleImport(event)} />
          </label>
        </div>
      </div>

      {message ? <p className="portal-alert-success">{message}</p> : null}
      {error ? <p className="portal-alert-error">{error}</p> : null}

      <section className="portal-card grid gap-4 md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Automatic Backup</p>
          <p className="mt-1 text-lg font-semibold">
            {data.summary.automaticBackupEnabled ? "ON" : "OFF"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Contacts Backed Up</p>
          <p className="mt-1 text-lg font-semibold">{data.summary.contactCount}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Last Backup</p>
          <p className="mt-1 text-sm font-medium">
            {data.summary.lastSuccessfulBackupAt
              ? new Date(data.summary.lastSuccessfulBackupAt).toLocaleString()
              : "Not yet"}
          </p>
        </div>
      </section>

      <section className="portal-card">
        <h2 className="text-lg font-semibold">Connected Devices</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Mobile apps synchronize automatically when the operating system permits background execution.
        </p>
        <div className="mt-4 space-y-3">
          {(data.devices ?? []).length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No mobile devices connected yet.</p>
          ) : (
            data.devices.map((device) => (
              <article
                key={device.id}
                className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {device.displayName}
                      {device.revokedAt ? " · Revoked" : ""}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {device.platform === "ANDROID" ? "Android" : "iPhone"} · Last sync{" "}
                      {device.lastSyncAt ? new Date(device.lastSyncAt).toLocaleString() : "never"}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Status: {device.lastSyncStatus ?? "unknown"}
                    </p>
                  </div>
                  {!device.revokedAt ? (
                    <button
                      type="button"
                      className="portal-danger-button"
                      onClick={() => void revokeDevice(device.id, device.displayName)}
                    >
                      Revoke
                    </button>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="portal-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Backed-up Contacts</h2>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void refresh(query);
              }
            }}
            placeholder="Search contacts..."
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>

        <div className="mt-4 space-y-3">
          {filteredContacts.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No backed-up contacts yet. Enable automatic backup in the CloudStoreNow mobile app.
            </p>
          ) : (
            filteredContacts.map((contact) => (
              <article key={contact.id} className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
                <p className="font-medium">{contact.displayName ?? "Unnamed contact"}</p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {contact.payload.phones[0]?.value ?? contact.payload.emails[0]?.value ?? contact.payload.organization ?? "No primary field"}
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  Updated {new Date(contact.updatedAt).toLocaleString()}
                </p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
