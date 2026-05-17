{{- define "sdm.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "sdm.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "sdm.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* Per-component fullnames */}}
{{- define "sdm.bff.fullname" -}}
{{- printf "%s-bff" (include "sdm.fullname" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- define "sdm.portal.fullname" -}}
{{- printf "%s-portal" (include "sdm.fullname" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- define "sdm.workspace.fullname" -}}
{{- printf "%s-workspace" (include "sdm.fullname" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* Common label set */}}
{{- define "sdm.labels" -}}
helm.sh/chart: {{ include "sdm.chart" . }}
{{ include "sdm.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: sdm-rewrite
{{- end -}}

{{- define "sdm.selectorLabels" -}}
app.kubernetes.io/name: {{ include "sdm.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "sdm.bff.labels" -}}
{{ include "sdm.labels" . }}
app.kubernetes.io/component: bff
{{- end -}}
{{- define "sdm.bff.selectorLabels" -}}
{{ include "sdm.selectorLabels" . }}
app.kubernetes.io/component: bff
{{- end -}}

{{- define "sdm.portal.labels" -}}
{{ include "sdm.labels" . }}
app.kubernetes.io/component: portal
{{- end -}}
{{- define "sdm.portal.selectorLabels" -}}
{{ include "sdm.selectorLabels" . }}
app.kubernetes.io/component: portal
{{- end -}}

{{- define "sdm.workspace.labels" -}}
{{ include "sdm.labels" . }}
app.kubernetes.io/component: workspace
{{- end -}}
{{- define "sdm.workspace.selectorLabels" -}}
{{ include "sdm.selectorLabels" . }}
app.kubernetes.io/component: workspace
{{- end -}}

{{/* Image refs — registry from .Values.image, repo+tag per-component. */}}
{{- define "sdm.bff.image" -}}
{{- $tag := default .Chart.AppVersion (default .Values.image.tag .Values.bff.image.tag) -}}
{{- printf "%s/%s:%s" .Values.image.registry .Values.bff.image.repository $tag -}}
{{- end -}}
{{- define "sdm.portal.image" -}}
{{- $tag := default .Chart.AppVersion (default .Values.image.tag .Values.portal.image.tag) -}}
{{- printf "%s/%s:%s" .Values.image.registry .Values.portal.image.repository $tag -}}
{{- end -}}
{{- define "sdm.workspace.image" -}}
{{- $tag := default .Chart.AppVersion (default .Values.image.tag .Values.workspace.image.tag) -}}
{{- printf "%s/%s:%s" .Values.image.registry .Values.workspace.image.repository $tag -}}
{{- end -}}

{{- define "sdm.bff.serviceAccountName" -}}
{{- if .Values.bff.serviceAccount.create -}}
{{- default (include "sdm.bff.fullname" .) .Values.bff.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.bff.serviceAccount.name -}}
{{- end -}}
{{- end -}}
