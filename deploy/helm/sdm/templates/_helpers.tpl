{{/*
Expand the name of the chart.
*/}}
{{- define "sdm.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create a default fully qualified app name.
*/}}
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

{{- define "sdm.bff.fullname" -}}
{{- printf "%s-bff" (include "sdm.fullname" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "sdm.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Common labels applied to every object.
*/}}
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

{{/*
Image reference assembly. Falls back to Chart.appVersion when image.tag is empty.
*/}}
{{- define "sdm.image" -}}
{{- $tag := default .Chart.AppVersion .Values.image.tag -}}
{{- printf "%s/%s:%s" .Values.image.registry .Values.image.repository $tag -}}
{{- end -}}

{{/*
ServiceAccount name resolver.
*/}}
{{- define "sdm.bff.serviceAccountName" -}}
{{- if .Values.bff.serviceAccount.create -}}
{{- default (include "sdm.bff.fullname" .) .Values.bff.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.bff.serviceAccount.name -}}
{{- end -}}
{{- end -}}
