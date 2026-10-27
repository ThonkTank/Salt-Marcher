export type DeskRef = {
  sectionId?: string;
  kind: 'note' | 'location' | 'creature' | 'item' | 'encounter';
  id: string;
};
