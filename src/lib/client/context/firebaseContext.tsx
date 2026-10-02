"use client";

import { createContext, useContext, useState } from "react";

type FirebaseContextType = {
  isFirebaseReady: boolean;
  setIsFirebaseReady: React.Dispatch<React.SetStateAction<boolean>>;
};

const FirebaseContext = createContext<FirebaseContextType | null>(null);

export function FirebaseContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);

  return (
    <FirebaseContext.Provider value={{ isFirebaseReady, setIsFirebaseReady }}>
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebaseContext() {
  const ctx = useContext(FirebaseContext);

  if (!ctx) {
    throw new Error("useFirebase must be used inside FirebaseProvider");
  }

  return ctx;
}
