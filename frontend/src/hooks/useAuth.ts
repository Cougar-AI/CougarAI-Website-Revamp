import { useEffect, useState } from "react";
import { getStoredUser, subscribeToAuthChanges, type StoredUser } from "@/lib/auth";

export function useAuth(): { user: StoredUser | null; isAuthenticated: boolean } {
  const [user, setUser] = useState<StoredUser | null>(() => getStoredUser());

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges(() => {
      setUser(getStoredUser());
    });
    return unsubscribe;
  }, []);

  return { user, isAuthenticated: user !== null };
}
