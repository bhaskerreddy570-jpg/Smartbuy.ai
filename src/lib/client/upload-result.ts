import type { DashboardData } from '@/lib/dashboard';

export type UploadCompletePayload = {
  fileId: string;
  status: 'READY' | 'PENDING';
  alreadyComplete?: boolean;
  file?: DashboardData['files'][number];
  storage?: DashboardData['storage'];
};

export function mergeUploadIntoDashboard(
  current: DashboardData,
  payload: UploadCompletePayload,
): DashboardData {
  if (!payload.file) {
    return payload.storage
      ? {
          ...current,
          storage: payload.storage,
        }
      : current;
  }

  const activeCategory = current.activeCategory;
  const fileMatchesView =
    !activeCategory || payload.file.category === activeCategory;
  const existingIndex = current.files.findIndex((file) => file.id === payload.file!.id);
  const nextFiles =
    existingIndex >= 0
      ? current.files.map((file, index) =>
          index === existingIndex ? payload.file! : file,
        )
      : fileMatchesView
        ? [payload.file, ...current.files]
        : current.files;

  return {
    ...current,
    storage: payload.storage ?? current.storage,
    categories: current.categories.map((category) =>
      category.id === payload.file!.category
        ? {
            ...category,
            count: existingIndex >= 0 ? category.count : category.count + 1,
          }
        : category,
    ),
    files: nextFiles,
  };
}
