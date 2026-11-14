# Immune Risk · DAG (grafo causal) del Human System Risk Board

> **Fuente:** NASA HSRB, *Immune Risk DAG Code (TXT)* — https://www.nasa.gov/wp-content/uploads/2025/09/immune-dag-code-sa-07566.txt
> **Narrativa y figura (PDF):** https://www.nasa.gov/wp-content/uploads/2025/09/immune-risk-narrative-dag-20231109.pdf
> **Ficha:** [immune-risk.md](immune-risk.md) · **Extraído:** 2026-11-14
>
> Transcripción de nodos y aristas del archivo original (exportado como JSON de grafo). Los nombres se dejan en inglés, tal como figuran en la NASA. AstroVitals usa un subconjunto en `lib/causas/grafos.js` (pantalla `/causas`).

## Nodos (49)

| Tipo | Nodos |
|---|---|
| Peligros (RIDGE) | Altered Gravity · Distance from Earth · Hostile Closed Environment · Isolation and Confinement · Radiation |
| Factores contribuyentes | Astronaut Selection · Atmospheric Conditions · Circadian Misalignment · Crew Capability · Crew Health and Performance System · Detect Immune Changes · Detect Long Term Health Outcomes · Individual Factors · Individual Readiness · Lab Blood Monitoring · Medical Illness · Medical Prevention Capability · Medical Treatment Capability · Microbial Virulence Factors · Oxidative Stress · Stress Relieving VR · Vehicle Design · Exercise · Inflammation · Microbiome · Nutrients · Probiotics · Stress · Supplements · Surveillance · HSP |
| Estados del riesgo | Persistent Subclinical Immune Dysregulation · Clinically Significant Immune Dysregulation |
| Riesgos relacionados | Behavioral Health (Risk) · Dust (Risk) · Food and Nutrition (Risk) · EIHSO (Risk) · Hypoxia, CO2 (Risks) · Microhost (Risk) · Pharm (Risk) · Sleep (Risk) · Team (Risk) |
| Resultados | Flight Recertification · Long Term Health Outcomes · Loss of Crew Life · Loss of Mission Objectives · Loss of Mission · Task Performance · Evacuation |

## Aristas (84)

```
Dust (Risk) -> Atmospheric Conditions
Hostile Closed Environment -> Atmospheric Conditions
Hypoxia, CO2 (Risks) -> Atmospheric Conditions
Distance from Earth -> Circadian Misalignment
Hostile Closed Environment -> Circadian Misalignment
Sleep (Risk) -> Circadian Misalignment
Individual Factors -> Clinically Significant Immune Dysregulation
Persistent Subclinical Immune Dysregulation -> Clinically Significant Immune Dysregulation
Individual Readiness -> Crew Capability
Team (Risk) -> Crew Capability
EIHSO (Risk) -> Crew Health and Performance System
Vehicle Design -> Crew Health and Performance System
Clinically Significant Immune Dysregulation -> Detect Immune Changes
Lab Blood Monitoring -> Detect Immune Changes
Persistent Subclinical Immune Dysregulation -> Detect Immune Changes
Long Term Health Outcomes -> Detect Long Term Health Outcomes
Surveillance -> Detect Long Term Health Outcomes
Astronaut Selection -> Individual Factors
Behavioral Health (Risk) -> Individual Readiness
Medical Illness -> Individual Readiness
Medical Treatment Capability -> Individual Readiness
Crew Health and Performance System -> Lab Blood Monitoring
Clinically Significant Immune Dysregulation -> Medical Illness
Medical Prevention Capability -> Medical Illness
Microbial Virulence Factors -> Medical Illness
Inflammation -> Medical Illness
Crew Health and Performance System -> Medical Prevention Capability
Pharm (Risk) -> Medical Prevention Capability
Crew Health and Performance System -> Medical Treatment Capability
Detect Immune Changes -> Medical Treatment Capability
Pharm (Risk) -> Medical Treatment Capability
Altered Gravity -> Microbial Virulence Factors
Hostile Closed Environment -> Microbial Virulence Factors
Microhost (Risk) -> Microbial Virulence Factors
Hypoxia, CO2 (Risks) -> Oxidative Stress
Microbiome -> Oxidative Stress
Nutrients -> Oxidative Stress
Radiation -> Oxidative Stress
Altered Gravity -> Persistent Subclinical Immune Dysregulation
Atmospheric Conditions -> Persistent Subclinical Immune Dysregulation
Circadian Misalignment -> Persistent Subclinical Immune Dysregulation
Individual Factors -> Persistent Subclinical Immune Dysregulation
Oxidative Stress -> Persistent Subclinical Immune Dysregulation
Exercise -> Persistent Subclinical Immune Dysregulation
Microbiome -> Persistent Subclinical Immune Dysregulation
Nutrients -> Persistent Subclinical Immune Dysregulation
Stress -> Persistent Subclinical Immune Dysregulation
Crew Health and Performance System -> Stress Relieving VR
Distance from Earth -> Vehicle Design
EIHSO (Risk) -> Vehicle Design
Crew Health and Performance System -> Exercise
Clinically Significant Immune Dysregulation -> Inflammation
Oxidative Stress -> Inflammation
Persistent Subclinical Immune Dysregulation -> Inflammation
Hostile Closed Environment -> Microbiome
Isolation and Confinement -> Microbiome
Microhost (Risk) -> Microbiome
HSP -> Microbiome
Distance from Earth -> Nutrients
Food and Nutrition (Risk) -> Nutrients
Hostile Closed Environment -> Nutrients
Probiotics -> Nutrients
Supplements -> Nutrients
Crew Health and Performance System -> Probiotics
Pharm (Risk) -> Probiotics
Hostile Closed Environment -> Stress
Isolation and Confinement -> Stress
Sleep (Risk) -> Stress
Stress Relieving VR -> Stress
Crew Health and Performance System -> Supplements
Pharm (Risk) -> Supplements
Medical Illness -> Behavioral Health (Risk)
Behavioral Health (Risk) -> Team (Risk)
Medical Illness -> Flight Recertification
Medical Illness -> Long Term Health Outcomes
Medical Illness -> Loss of Crew Life
Medical Treatment Capability -> Loss of Crew Life
Evacuation -> Loss of Crew Life
Task Performance -> Loss of Mission Objectives
Evacuation -> Loss of Mission Objectives
Loss of Mission Objectives -> Loss of Mission
Crew Capability -> Task Performance
Medical Illness -> Evacuation
Medical Treatment Capability -> Evacuation
```
