import { create } from "zustand";

interface HoverState {
  countryCode: string | null;
  setHovered: (countryCode: string | null) => void;
}

export const useHoverStore = create<HoverState>((set, get) => ({
  countryCode: null,
  setHovered: (countryCode) => {
    if (get().countryCode !== countryCode) set({ countryCode });
  },
}));
