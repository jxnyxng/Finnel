// Holds a Twelve Data exchange spec with its most recent current-rate fetch time.
package com.example.krwwatcher.service;

import java.time.Instant;

record TwelveDataExchangeCandidate(TwelveDataExchangeSpec spec, Instant latestFetchedAt) {
}
