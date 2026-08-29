package com.example.krwwatcher.service;

// Normalized pagination parameters for news list responses.
record NewsPageRequest(int page, int pageSize, int offset) {
}
