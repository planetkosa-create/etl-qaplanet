export const sqlSample = `-- 1. Row Count Validation: Source vs Target
SELECT 'COUNT' AS chk_type,
       'TAR1' AS target_table,
       (
         SELECT COUNT(*) AS src_count
         FROM SRC_PAYMENTS_STG
         WHERE TRUNC(LOAD_DT) = :LOAD_DATE
       )
       -
       (
         SELECT COUNT(*) AS tgt_count
         FROM TGT_PAYMENTS_DW
         WHERE TRUNC(LOAD_DT) = :LOAD_DATE
       ) AS count_diff,
       CASE
         WHEN (
           SELECT COUNT(*)
           FROM SRC_PAYMENTS_STG
         ) > 0
         THEN ROUND(
           (
             (
               SELECT COUNT(*)
               FROM TGT_PAYMENTS_DW
             )
             -
             (
               SELECT COUNT(*)
               FROM SRC_PAYMENTS_STG
             )
           )
           /
           (
             SELECT COUNT(*)
             FROM SRC_PAYMENTS_STG
           ) * 100,
           2
         )
         ELSE NULL
       END AS pct_diff,
       'ROW_COUNT_CHECK' AS check_name,
       'PAYMENTS_DW' AS src_system
FROM DUAL;`;

export const metricCards = [
  {
    label: "Uploaded Documents",
    count: "4",
    status: "Processed",
    icon: "FileText",
    accent: "blue",
  },
  {
    label: "Extracted Rules",
    count: "28",
    status: "Ready",
    icon: "Lightbulb",
    accent: "teal",
  },
  {
    label: "Generated SQL Checks",
    count: "42",
    status: "Ready",
    icon: "Code2",
    accent: "blue",
  },
  {
    label: "Oracle Statements",
    count: "18",
    status: "Ready",
    icon: "Database",
    accent: "red",
  },
  {
    label: "Reconciliation Scenarios",
    count: "12",
    status: "Ready",
    icon: "Scale",
    accent: "blue",
  },
] as const;

export const uploadedArtifacts = [
  {
    fileName: "BRD_ETL_Payments_v1.docx",
    type: "DOCX",
    size: "2.31 MB",
    uploadedOn: "May 20, 2024 10:21 AM",
    status: "Processed",
  },
  {
    fileName: "Source_to_Target_Mapping.xlsx",
    type: "XLSX",
    size: "1.1 MB",
    uploadedOn: "May 20, 2024 10:22 AM",
    status: "Processed",
  },
  {
    fileName: "Oracle_Transformations_Logic.pdf",
    type: "PDF",
    size: "884 KB",
    uploadedOn: "May 20, 2024 10:22 AM",
    status: "Processed",
  },
  {
    fileName: "Data_Definitions.csv",
    type: "CSV",
    size: "521 KB",
    uploadedOn: "May 20, 2024 10:24 AM",
    status: "Processed",
  },
] as const;

export const analysisOverview = [
  { label: "Source-to-Target Mappings", count: 16, icon: "GitBranch", accent: "green" },
  { label: "Transformation Rules", count: 28, icon: "Atom", accent: "purple" },
  { label: "Join Conditions", count: 14, icon: "Waypoints", accent: "teal" },
  { label: "Null Handling Rules", count: 11, icon: "SearchCheck", accent: "orange" },
  { label: "Aggregation Logic", count: 9, icon: "Activity", accent: "blue" },
  { label: "Data Quality Constraints", count: 23, icon: "ShieldCheck", accent: "pink" },
] as const;

export const validationPacks = [
  {
    title: "Row Count Reconciliation",
    badge: "SQL",
    checks: "2 Checks",
    icon: "Rows3",
    accent: "blue",
  },
  {
    title: "Sum/Amount Validation",
    badge: "SQL",
    checks: "3 Checks",
    icon: "ChartNoAxesCombined",
    accent: "green",
  },
  {
    title: "Duplicate Detection",
    badge: "Oracle",
    checks: "2 Checks",
    icon: "PanelsTopLeft",
    accent: "orange",
  },
  {
    title: "Primary Key Integrity",
    badge: "SQL",
    checks: "2 Checks",
    icon: "KeyRound",
    accent: "blue",
  },
  {
    title: "Null Handling Validation",
    badge: "SQL",
    checks: "3 Checks",
    icon: "Braces",
    accent: "blue",
  },
  {
    title: "Transformation Logic Checks",
    badge: "Cross-Platform",
    checks: "2 Checks",
    icon: "Landmark",
    accent: "red",
  },
] as const;

export const etlTeamNeeds = [
  {
    title: "Source/Target Mapping Coverage",
    description: "Ensure all source data is mapped and validated.",
    icon: "FileSearch",
  },
  {
    title: "Transformation Rule Traceability",
    description: "Every rule is extracted and validated.",
    icon: "Workflow",
  },
  {
    title: "Oracle / SQL Compatibility",
    description: "Generate version-safe SQL & Oracle statements.",
    icon: "RefreshCcw",
  },
  {
    title: "Reconciliation Assurance",
    description: "Validate row counts, sums, and key metrics.",
    icon: "ChartPie",
  },
  {
    title: "Data Quality Assertions",
    description: "Detect nulls, duplicates, and business rule breaches.",
    icon: "ShieldCheck",
  },
  {
    title: "Audit-Ready Exports",
    description: "Export scripts, evidence, and execution logs.",
    icon: "FileArchive",
  },
] as const;

export const securityItems = [
  "SOC 2 Type II Compliant",
  "GDPR Compliant",
  "Data encrypted in transit and at rest",
  "Role-based access control (RBAC)",
  "Activity logging & audit trail",
] as const;

export const placeholderPages = {
  "/requirements-upload": {
    title: "Requirements Upload",
    description: "Upload ETL BRDs, mappings, PDFs, spreadsheets, and data dictionaries.",
    phase: "Coming in Phase 2",
    previews: [
      "Drag-and-drop ingestion for BRDs, mapping workbooks, PDFs, CSVs, and data dictionaries.",
      "Document queue with processing status, owner, source system, and validation coverage.",
    ],
  },
  "/mapping-analysis": {
    title: "Mapping Analysis",
    description: "Analyze source-to-target mappings and detect missing coverage.",
    phase: "Coming in Phase 2",
    previews: [
      "Coverage matrix for source columns, target fields, joins, filters, and transformations.",
      "Gap detection for unmapped fields, ambiguous targets, and missing data definitions.",
    ],
  },
  "/rule-extraction": {
    title: "Rule Extraction",
    description: "Extract transformation, join, aggregation, and null-handling rules.",
    phase: "Coming in Phase 2",
    previews: [
      "Traceable rule inventory linked back to source documents and mapping rows.",
      "Review workflow for transformation logic, data quality constraints, and exceptions.",
    ],
  },
  "/sql-validator-generator": {
    title: "SQL Validator Generator",
    description: "Generate SQL and Oracle validation statements.",
    phase: "Coming in Phase 2",
    previews: [
      "Script generation for row counts, sums, duplicates, constraints, and business rules.",
      "Environment-aware SQL templates with parameters, comments, and execution notes.",
    ],
  },
  "/oracle-checks": {
    title: "Oracle Checks",
    description: "Oracle-specific validation checks and PL/SQL-ready scripts.",
    phase: "Coming in Phase 2",
    previews: [
      "Oracle 19c-ready validation packs with bind variables and scheduler-friendly scripts.",
      "PL/SQL blocks for repeatable execution, logging, and exception-safe reporting.",
    ],
  },
  "/reconciliation-suite": {
    title: "Reconciliation Suite",
    description: "Row count, sum, amount, and control total reconciliation.",
    phase: "Coming in Phase 2",
    previews: [
      "Scenario builder for source-to-target counts, financial totals, and control records.",
      "Execution readiness scoring for automated, review-needed, and manual checks.",
    ],
  },
  "/data-quality-checks": {
    title: "Data Quality Checks",
    description: "Duplicate, null, referential integrity, and constraint validation.",
    phase: "Coming in Phase 2",
    previews: [
      "Reusable checks for nulls, duplicates, referential integrity, formats, and thresholds.",
      "Rule severity, ownership, and evidence tracking for audit-ready QA cycles.",
    ],
  },
  "/export-center": {
    title: "Export Center",
    description: "Export validation packs, scripts, CSV, Excel, and audit evidence.",
    phase: "Coming in Phase 2",
    previews: [
      "Export SQL, Oracle scripts, review packs, execution evidence, and traceability reports.",
      "Download history with versioning, generated-by metadata, and approval status.",
    ],
  },
  "/settings": {
    title: "Settings",
    description: "Manage workspace preferences, database targets, and security options.",
    phase: "Coming in Phase 2",
    previews: [
      "Workspace preferences for database targets, SQL dialects, naming, and timezone.",
      "Supabase-ready security settings for RBAC, audit logging, and team access.",
    ],
  },
} as const;
