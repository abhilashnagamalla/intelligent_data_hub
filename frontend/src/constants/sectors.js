export const sectorLabels = {
  agriculture: 'Agriculture',
  census: 'Census and Surveys',
  education: 'Education',
  finance: 'Finance',
  health: 'Health and Family Welfare',
  transport: 'Transport',
};

export function formatSectorLabel(sector) {
  if (!sector) return '';
  return sectorLabels[sector.toLowerCase()] || sector.charAt(0).toUpperCase() + sector.slice(1).toLowerCase();
}
