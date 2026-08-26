/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADSENSE_SLOT_DOLLAR_INDEX_DESKTOP?: string;
  readonly VITE_ADSENSE_SLOT_DOLLAR_INDEX_MOBILE?: string;
  readonly VITE_ADSENSE_SLOT_TAB_CALCULATOR?: string;
  readonly VITE_ADSENSE_SLOT_TAB_DASHBOARD?: string;
  readonly VITE_ADSENSE_SLOT_TAB_DATA_SOURCES?: string;
  readonly VITE_ADSENSE_SLOT_TAB_DEFAULT?: string;
  readonly VITE_ADSENSE_SLOT_TAB_EXCHANGE_GUIDE?: string;
  readonly VITE_ADSENSE_SLOT_TAB_KOREA_STATUS?: string;
  readonly VITE_ADSENSE_SLOT_TAB_NEWSROOM?: string;
  readonly VITE_ADSENSE_SLOT_TAB_POLICY_BRIEFINGS?: string;
  readonly VITE_ADSENSE_SLOT_TAB_RANKING?: string;
  readonly VITE_ADSENSE_SLOT_TAB_TODAY_FLOW?: string;
  readonly VITE_ADSENSE_SLOT_NEWSROOM_IN_FEED?: string;
  readonly VITE_ADSENSE_SLOT_POLICY_BRIEFINGS_IN_FEED?: string;
  readonly VITE_ADSENSE_SLOT_USD_KRW_DESKTOP?: string;
  readonly VITE_ADSENSE_SLOT_USD_KRW_MOBILE?: string;
  readonly VITE_GOOGLE_ADSENSE_CLIENT?: string;
  readonly VITE_GOOGLE_ADSENSE_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
