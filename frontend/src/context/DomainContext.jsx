import { createContext, useContext, useState } from 'react';
import { useParams } from 'react-router-dom';

/* eslint-disable react-refresh/only-export-components */
const DomainContext = createContext();

export function DomainProvider({ children }) {
  const { sector } = useParams();
  const [currentDomain, setCurrentDomain] = useState(sector || null);

  return (
    <DomainContext.Provider value={{ currentDomain, setCurrentDomain }}>
      {children}
    </DomainContext.Provider>
  );
}

export const useDomain = () => {
  const context = useContext(DomainContext);
  if (!context) throw new Error('useDomain must be used within DomainProvider');
  return context;
};
