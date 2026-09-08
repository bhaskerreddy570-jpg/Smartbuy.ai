"use client";

import { useEffect, useMemo, useState } from "react";
import type { ContactsPortalData } from "@/lib/contacts/portal-data";

type ContactRecord = ContactsPortalData["contacts"][number];
type DeviceRecord = ContactsPortalData["devices"][number];

type PairingSession = {
  sessionId: string;
  pairingCode: string;
  expiresAt: string;
  qrDataUrl: string;
  instructions: string;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Not yet";
  }
  return new Date(value).toLocaleString();
}

function PairingModal({
  open,
  onClose,
  onPaired,
}: {
  open: boolean;
  onClose: () => void;
  onPaired: () => Promise<void>;
}) {
  if (!open) {
    return null;
  }

  return <PairingModalContent onClose={onClose} onPaired={onPaired} />;
}

function PairingModalContent({
  onClose,
  onPaired,
}: {
  onClose: () => void;
  onPaired: () => Promise<void>;
}) {
  const [session, setSession] = useState<PairingSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const response = await fetch("/api/contacts/devices/pairing", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as PairingSession & {
        error?: string;
      } | null;

      if (cancelled) {
        return;
      }

      if (!response.ok || !payload?.sessionId) {
        setError("Unable to start device pairing");
        setLoading(false);
        return;
      }

      setSession(payload);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    let cancelled = false;
    const interval = window.setInterval(() => {
      void (async () => {
        const response = await fetch(`/api/contacts/devices/pairing/${session.sessionId}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as {
          status?: string;
          device?: { displayName?: string };
        } | null;

        if (cancelled || !response.ok || !payload?.status) {
          return;
        }

        if (payload.status === "completed") {
          setStatusMessage(
            payload.device?.displayName
              ? `${payload.device.displayName} connected successfully`
              : "Device connected successfully",
          );
          await onPaired();
          window.setTimeout(() => {
            onClose();
          }, 1200);
        } else if (payload.status === "expired") {
          setError("Pairing code expired. Start again to connect a device.");
        }
      })();
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [session, onClose, onPaired]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pair-device-title"
        className="w-full max-w-lg rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-950"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="pair-device-title" className="text-lg font-semibold">
              Connect a device
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Open the CloudStoreNow mobile app, sign in to this account, then scan or enter the
              pairing code before it expires.
            </p>
          </div>
          <button type="button" className="portal-secondary-button" onClick={onClose}>
            Close
          </button>
        </div>

        {loading ? (
          <p className="portal-alert-success mt-4">Preparing pairing code...</p>
        ) : null}
        {error ? <p className="portal-alert-error mt-4">{error}</p> : null}
        {statusMessage ? <p className="portal-alert-success mt-4">{statusMessage}</p> : null}

        {session ? (
          <div className="mt-6 space-y-4">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              {/* eslint-disable-next-line @next/next/no-img-element -- QR data URLs are generated at runtime */}
              <img
                src={session.qrDataUrl}
                alt="Device pairing QR code"
                className="h-48 w-48 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-700"
              />
              <div className="text-center sm:text-left">
                <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Pairing code
                </p>
                <p className="mt-1 font-mono text-3xl font-semibold tracking-[0.2em]">
                  {session.pairingCode}
                </p>
                <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                  Expires {formatDateTime(session.expiresAt)}
                </p>
              </div>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{session.instructions}</p>
            <p className="text-xs text-zinc-400">
              Pairing codes are short-lived and single-use. They never contain passwords, storage
              credentials, or encryption secrets.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ContactsClient({
  initialData,
  embedded = false,
}: {
  initialData: ContactsPortalData;
  embedded?: boolean;
}) {
  const [data, setData] = useState<ContactsPortalData>(initialData);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pairingOpen, setPairingOpen] = useState(false);

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

    setData((await response.json()) as ContactsPortalData);
  }

  const filteredContacts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return data.contacts;
    }
    return data.contacts.filter((contact) =>
      `${contact.displayName ?? ""} ${JSON.stringify(contact.payload)}`
        .toLowerCase()
        .includes(needle),
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
      setError(
        payload?.error === "STORAGE_QUOTA_EXCEEDED"
          ? "Storage quota exceeded"
          : "Unable to import VCF",
      );
      setBusy(false);
      return;
    }

    setMessage(`${payload?.imported ?? 0} contact(s) imported from VCF`);
    await refresh(query);
    setBusy(false);
  }

  async function revokeDevice(deviceId: string, name: string) {
    if (
      !window.confirm(
        `Disconnect ${name}? The device will stop syncing, but your backed-up contacts remain in CloudStoreNow.`,
      )
    ) {
      return;
    }

    const response = await fetch(`/api/contacts/devices/${deviceId}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Unable to revoke device");
      return;
    }

    setMessage(`${name} disconnected`);
    await refresh(query);
  }

  const activeDevices = data.devices.filter((device) => !device.revokedAt);

  return (
    <div className={embedded ? "space-y-6" : "space-y-6 pb-24 lg:pb-6"}>
      {!embedded ? (
        <div className="portal-page-header">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Contacts</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Automatic mobile backup status and backed-up contact records.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="portal-secondary-button"
              disabled={busy}
              onClick={() => void handleExport()}
            >
              Export VCF
            </button>
            <label className="portal-primary-button cursor-pointer">
              Import VCF
              <input
                type="file"
                accept=".vcf,.vcard,text/vcard"
                className="hidden"
                disabled={busy}
                onChange={(event) => void handleImport(event)}
              />
            </label>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Contact backup</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Contacts are stored in your CloudStoreNow account and count toward your storage quota.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="portal-secondary-button"
              disabled={busy}
              onClick={() => void handleExport()}
            >
              Export VCF
            </button>
            <label className="portal-primary-button cursor-pointer">
              Import VCF
              <input
                type="file"
                accept=".vcf,.vcard,text/vcard"
                className="hidden"
                disabled={busy}
                onChange={(event) => void handleImport(event)}
              />
            </label>
          </div>
        </div>
      )}

      {message ? <p className="portal-alert-success">{message}</p> : null}
      {error ? <p className="portal-alert-error">{error}</p> : null}

      <section className="portal-card grid gap-4 md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Automatic Backup
          </p>
          <p className="mt-1 text-lg font-semibold">
            {data.summary.automaticBackupEnabled ? "ON" : "OFF"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Contacts Backed Up
          </p>
          <p className="mt-1 text-lg font-semibold">{data.summary.contactCount}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Last Backup
          </p>
          <p className="mt-1 text-sm font-medium">
            {formatDateTime(data.summary.lastSuccessfulBackupAt)}
          </p>
        </div>
      </section>

      <section className="portal-card">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          After you approve Contacts access once in the mobile app, CloudStoreNow keeps automatic
          backup enabled. Android and iOS control when background sync runs, so changes may not
          upload instantly every second.
        </p>
        <p className="mt-2 text-xs text-zinc-400">
          Manual Backup Now remains available in the mobile app when you want an immediate sync.
        </p>
      </section>

      <section className="portal-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Connected Devices</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Register a phone or tablet to back up contacts automatically when the operating system
              allows background execution.
            </p>
          </div>
          <button
            type="button"
            className="portal-primary-button"
            onClick={() => setPairingOpen(true)}
          >
            Connect a device
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {activeDevices.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 p-6 text-center dark:border-zinc-700">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No mobile devices connected yet.
              </p>
              <button
                type="button"
                className="portal-primary-button mt-4"
                onClick={() => setPairingOpen(true)}
              >
                Connect a device
              </button>
            </div>
          ) : (
            activeDevices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                onRevoke={() => void revokeDevice(device.id, device.displayName)}
              />
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
              No backed-up contacts yet. Connect a mobile device and approve Contacts access to
              start automatic backup.
            </p>
          ) : (
            filteredContacts.map((contact) => (
              <ContactCard key={contact.id} contact={contact} />
            ))
          )}
        </div>
      </section>

      <PairingModal
        key={pairingOpen ? "open" : "closed"}
        open={pairingOpen}
        onClose={() => setPairingOpen(false)}
        onPaired={async () => refresh(query)}
      />
    </div>
  );
}

function DeviceCard({
  device,
  onRevoke,
}: {
  device: DeviceRecord;
  onRevoke: () => void;
}) {
  return (
    <article className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{device.displayName}</p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {device.platform === "ANDROID" ? "Android" : "iPhone"} · Connected{" "}
            {formatDateTime(device.createdAt)}
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Automatic Backup: {device.automaticBackupEnabled ? "ON" : "OFF"}
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Last backup: {formatDateTime(device.lastSyncAt)}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Last seen: {formatDateTime(device.lastSeenAt)} · Status:{" "}
            {device.lastSyncStatus ?? "unknown"}
          </p>
        </div>
        <button type="button" className="portal-danger-button" onClick={onRevoke}>
          Disconnect
        </button>
      </div>
    </article>
  );
}

function ContactCard({ contact }: { contact: ContactRecord }) {
  return (
    <article className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
      <p className="font-medium">{contact.displayName ?? "Unnamed contact"}</p>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {contact.payload.phones[0]?.value ??
          contact.payload.emails[0]?.value ??
          contact.payload.organization ??
          "No primary field"}
      </p>
      <p className="mt-1 text-xs text-zinc-400">
        Updated {new Date(contact.updatedAt).toLocaleString()}
      </p>
    </article>
  );
}
