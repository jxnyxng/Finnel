package com.example.krwwatcher.batch;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.batch.core.JobExecution;
import org.springframework.batch.core.JobInstance;
import org.springframework.batch.core.JobParameter;
import org.springframework.batch.core.StepExecution;
import org.springframework.batch.core.explore.JobExplorer;
import org.springframework.stereotype.Service;

@Service
public class BatchMetadataService {

    private static final int DEFAULT_INSTANCE_SCAN_LIMIT = 20;
    private static final int MAX_EXECUTION_LIMIT = 100;

    private final JobExplorer jobExplorer;

    public BatchMetadataService(JobExplorer jobExplorer) {
        this.jobExplorer = jobExplorer;
    }

    public BatchJobsResponse jobs() {
        List<BatchJobSummary> jobs = jobExplorer.getJobNames().stream()
            .sorted()
            .map(jobName -> new BatchJobSummary(jobName, latestExecution(jobName)))
            .toList();
        return new BatchJobsResponse(jobs);
    }

    public BatchJobLatestResponse latest(String jobName) {
        return new BatchJobLatestResponse(jobName, latestExecution(jobName));
    }

    public BatchJobExecutionsResponse executions(String jobName, int limit) {
        int normalizedLimit = Math.max(1, Math.min(limit, MAX_EXECUTION_LIMIT));
        List<BatchJobExecutionSummary> executions = jobExplorer.getJobInstances(jobName, 0, normalizedLimit)
            .stream()
            .flatMap(instance -> jobExplorer.getJobExecutions(instance).stream())
            .sorted(executionComparator().reversed())
            .limit(normalizedLimit)
            .map(BatchMetadataService::toExecutionSummary)
            .toList();
        return new BatchJobExecutionsResponse(jobName, executions);
    }

    private BatchJobExecutionSummary latestExecution(String jobName) {
        return jobExplorer.getJobInstances(jobName, 0, DEFAULT_INSTANCE_SCAN_LIMIT)
            .stream()
            .flatMap(instance -> jobExplorer.getJobExecutions(instance).stream())
            .max(executionComparator())
            .map(BatchMetadataService::toExecutionSummary)
            .orElse(null);
    }

    private static Comparator<JobExecution> executionComparator() {
        return Comparator
            .comparing(JobExecution::getCreateTime, Comparator.nullsFirst(Comparator.naturalOrder()))
            .thenComparing(JobExecution::getId, Comparator.nullsFirst(Comparator.naturalOrder()));
    }

    private static BatchJobExecutionSummary toExecutionSummary(JobExecution execution) {
        JobInstance instance = execution.getJobInstance();
        List<BatchStepExecutionSummary> steps = execution.getStepExecutions().stream()
            .sorted(Comparator.comparing(StepExecution::getStepName))
            .map(BatchMetadataService::toStepSummary)
            .toList();
        return new BatchJobExecutionSummary(
            execution.getId(),
            instance == null ? null : instance.getInstanceId(),
            instance == null ? null : instance.getJobName(),
            execution.getStatus() == null ? null : execution.getStatus().name(),
            execution.getExitStatus() == null ? null : execution.getExitStatus().getExitCode(),
            execution.getExitStatus() == null ? null : execution.getExitStatus().getExitDescription(),
            execution.getCreateTime(),
            execution.getStartTime(),
            execution.getEndTime(),
            execution.getLastUpdated(),
            parameters(execution),
            steps
        );
    }

    private static BatchStepExecutionSummary toStepSummary(StepExecution stepExecution) {
        return new BatchStepExecutionSummary(
            stepExecution.getId(),
            stepExecution.getStepName(),
            stepExecution.getStatus() == null ? null : stepExecution.getStatus().name(),
            stepExecution.getExitStatus() == null ? null : stepExecution.getExitStatus().getExitCode(),
            stepExecution.getReadCount(),
            stepExecution.getWriteCount(),
            stepExecution.getCommitCount(),
            stepExecution.getRollbackCount(),
            stepExecution.getStartTime(),
            stepExecution.getEndTime(),
            stepExecution.getLastUpdated()
        );
    }

    private static Map<String, BatchJobParameterValue> parameters(JobExecution execution) {
        return execution.getJobParameters().getParameters().entrySet().stream()
            .collect(Collectors.toMap(
                Map.Entry::getKey,
                entry -> toParameterValue(entry.getValue())
            ));
    }

    private static BatchJobParameterValue toParameterValue(JobParameter<?> parameter) {
        return new BatchJobParameterValue(
            parameter.getValue() == null ? null : parameter.getValue().toString(),
            parameter.getType().getSimpleName(),
            parameter.isIdentifying()
        );
    }

    public record BatchJobsResponse(List<BatchJobSummary> jobs) {
    }

    public record BatchJobSummary(String jobName, BatchJobExecutionSummary latestExecution) {
    }

    public record BatchJobLatestResponse(String jobName, BatchJobExecutionSummary latestExecution) {
    }

    public record BatchJobExecutionsResponse(String jobName, List<BatchJobExecutionSummary> executions) {
    }

    public record BatchJobExecutionSummary(
        Long executionId,
        Long instanceId,
        String jobName,
        String status,
        String exitCode,
        String exitDescription,
        LocalDateTime createTime,
        LocalDateTime startTime,
        LocalDateTime endTime,
        LocalDateTime lastUpdated,
        Map<String, BatchJobParameterValue> parameters,
        List<BatchStepExecutionSummary> steps
    ) {
    }

    public record BatchJobParameterValue(String value, String type, boolean identifying) {
    }

    public record BatchStepExecutionSummary(
        Long stepExecutionId,
        String stepName,
        String status,
        String exitCode,
        long readCount,
        long writeCount,
        long commitCount,
        long rollbackCount,
        LocalDateTime startTime,
        LocalDateTime endTime,
        LocalDateTime lastUpdated
    ) {
    }
}
