import agricultureBackground from '../../images/agriculture.png';
import censusBackground from '../../images/census.png';
import chatbotBackground from '../../images/chatbot.png';
import educationBackground from '../../images/education.png';
import financeBackground from '../../images/finance.png';
import healthBackground from '../../images/health.png';
import loginBackground from '../../images/login_page.png';
import overviewBackground from '../../images/overview.png';
import profileBackground from '../../images/profile.png';
import transportBackground from '../../images/transport.png';

const sectorBackgrounds = {
  agriculture: agricultureBackground,
  census: censusBackground,
  education: educationBackground,
  finance: financeBackground,
  health: healthBackground,
  overview: overviewBackground,
  transport: transportBackground,
};

export const landingBackground = loginBackground;
export const defaultSectorBackground = overviewBackground;
export const overviewPageBackground = overviewBackground;
export const chatbotPageBackground = chatbotBackground;
export const profilePageBackground = profileBackground;

export function getSectorBackground(sector) {
  const normalizedSector = sector?.toLowerCase?.() || '';
  return sectorBackgrounds[normalizedSector] || defaultSectorBackground;
}
