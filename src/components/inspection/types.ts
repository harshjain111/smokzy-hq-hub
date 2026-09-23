export type ItemStatus = 'pass' | 'attention' | 'fail';

export interface ItemPhoto {
  file: File;
  preview: string;
}

export interface ItemState {
  status: ItemStatus | null; // null = not yet reviewed by the manager
  reason: string;
  notes: string;
  photos: ItemPhoto[];
}

export type ItemStates = Record<string, ItemState>;

export interface PreviousInspection {
  id: string;
  date: string;
  time: string;
  score: number | null;
  items: Record<string, ItemStatus>;
}

export const QUICK_REASONS = [
  "Uniform issue",
  "Hygiene issue",
  "Appearance issue",
  "Staff behaviour",
  "Stock below threshold",
  "Equipment damaged",
  "Safety issue",
  "Other",
];

export const emptyItemState = (): ItemState => ({ status: null, reason: "", notes: "", photos: [] });
