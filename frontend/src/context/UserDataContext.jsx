import { createContext, useContext, useEffect, useState } from "react";
import api from "../api";
import { AuthContext } from "./AuthContextFixed";

/* eslint-disable react-refresh/only-export-components */
export const UserDataContext = createContext();

export default function UserDataProvider({ children }) {
  const { user } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!user?.token) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await api.get("/profile/me");
        if (!cancelled) {
          setProfile(response.data || null);
        }
      } catch {
        if (!cancelled) {
          setProfile(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [user?.token]);

  useEffect(() => {
    if (!user?.token) return undefined;

    const handleRefresh = () => {
      api.get("/profile/me").then((response) => {
        setProfile(response.data || null);
      }).catch(() => {});
    };

    window.addEventListener("idh:engagement-updated", handleRefresh);
    return () => {
      window.removeEventListener("idh:engagement-updated", handleRefresh);
    };
  }, [user?.token]);

  const applyWishlistPayload = (payload) => {
    setProfile((current) => ({
      ...(current || {}),
      user: current?.user || user,
      analytics: current?.analytics || {
        datasetsExplored: 0,
        totalDownloads: 0,
        totalViews: 0,
      },
      wishlist: payload?.wishlist || [],
      wishlistIds: payload?.wishlistIds || [],
    }));
  };

  const refreshProfile = async () => {
    if (!user?.token) {
      setProfile(null);
      return null;
    }
    const response = await api.get("/profile/me");
    setProfile(response.data || null);
    return response.data || null;
  };

  const isWishlisted = (datasetId) => {
    const ids = profile?.wishlistIds || [];
    return ids.includes(datasetId);
  };

  const toggleWishlist = async (dataset) => {
    if (!user?.token) {
      return { requiresAuth: true };
    }

    if (isWishlisted(dataset.id)) {
      const response = await api.delete(`/profile/wishlist/${encodeURIComponent(dataset.id)}`);
      applyWishlistPayload(response.data);
      return { saved: false, response: response.data };
    }

    const response = await api.post("/profile/wishlist", {
      datasetId: dataset.id,
      sector: dataset.sectorKey || dataset.sector || "",
      title: dataset.title,
      description: dataset.description,
      organization: dataset.organization,
      publishedDate: dataset.publishedDate,
      updatedDate: dataset.updatedDate,
    });
    applyWishlistPayload(response.data);
    return { saved: true, response: response.data };
  };

  return (
    <UserDataContext.Provider
      value={{
        profile,
        loading,
        wishlist: profile?.wishlist || [],
        wishlistIds: profile?.wishlistIds || [],
        analytics: profile?.analytics || {
          datasetsExplored: 0,
          totalDownloads: 0,
          totalViews: 0,
        },
        refreshProfile,
        toggleWishlist,
        isWishlisted,
      }}
    >
      {children}
    </UserDataContext.Provider>
  );
}
