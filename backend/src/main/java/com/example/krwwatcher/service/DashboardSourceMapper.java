// Maps dashboard source labels and optional detail URLs to public source links.
package com.example.krwwatcher.service;

class DashboardSourceMapper {

    private static final String TWELVE_DATA_USD_KRW_URL = "https://twelvedata.com/currencies/usd-krw";
    private static final String FRED_URL = "https://fred.stlouisfed.org/";
    private static final String ECOS_URL = "https://ecos.bok.or.kr/";
    private static final String KOREAEXIM_URL = "https://www.koreaexim.go.kr/";
    private static final String OPENFISCAL_URL = "https://www.openfiscaldata.go.kr/";
    private static final String BIS_URL = "https://data.bis.org/";

    String label(String source) {
        if (source == null) {
            return null;
        }
        return source.split("\\|", 2)[0];
    }

    String detailUrl(String source) {
        if (source == null || !source.contains("|")) {
            return null;
        }
        return source.split("\\|", 2)[1];
    }

    String url(String source, String detailUrl) {
        return resolveUrl(source, detailUrl);
    }

    static String resolveUrl(String source, String detailUrl) {
        if (detailUrl != null) {
            return detailUrl;
        }
        if (source == null) {
            return null;
        }
        if (source.startsWith("Twelve Data")) {
            return TWELVE_DATA_USD_KRW_URL;
        }
        if (source.startsWith("FRED")) {
            return FRED_URL;
        }
        if (source.startsWith("ECOS")) {
            return ECOS_URL;
        }
        if (source.startsWith("KOREAEXIM") || source.startsWith("Koreaexim")) {
            return KOREAEXIM_URL;
        }
        if (source.startsWith("OPENFISCAL")) {
            return OPENFISCAL_URL;
        }
        if (source.startsWith("BIS")) {
            return BIS_URL;
        }
        return null;
    }
}
