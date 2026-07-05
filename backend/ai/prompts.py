from typing import Dict, Any, List, Optional

def build_investigation_prompt(
    resource_type: str,
    name: str,
    namespace: str,
    status_summary: Dict[str, Any],
    events: List[Dict[str, Any]],
    logs: Optional[str],
    related_resources: Dict[str, Any]
) -> str:
    """
    Constructs a beginner-friendly investigation prompt with rich Kubernetes resource context.
    """
    events_str = ""
    if events:
        for ev in events:
            events_str += f"- [{ev.get('type')}] Reason: {ev.get('reason')} - {ev.get('message')} (Count: {ev.get('count')})\n"
    else:
        events_str = "No recent events recorded."

    related_str = ""
    if related_resources:
        for r_type, r_list in related_resources.items():
            related_str += f"### Related {r_type}s:\n"
            for r in r_list:
                related_str += f"- Name: {r.get('name')}, Status: {r.get('status')}\n"
    else:
        related_str = "No related resources found."

    prompt = f"""
You are Podex, a Kubernetes tutor and system administrator helping a beginner developer troubleshoot their local cluster.
The user is investigating a failing or degraded resource. Analyze the context and provide a structured explanation.

RESOURCE UNDER INVESTIGATION:
Type: {resource_type}
Name: {name}
Namespace: {namespace}

STATUS SUMMARY:
{json_to_yaml_like(status_summary)}

RECENT KUBERNETES EVENTS:
{events_str}

CONTAINER LOGS (if applicable):
{"--- LOGS START ---" if logs else "No logs available or resource type does not produce logs."}
{logs or ""}
{"--- LOGS END ---" if logs else ""}

RELATED RESOURCES IN CLUSTER:
{related_str}

Please perform a thorough investigation. Fill out the response schema precisely:
- Status: One of 'healthy', 'degraded', or 'critical' based on the overall resource health.
- Root Cause: Pinpoint the exact issue (e.g. ImagePullBackOff, wrong Port mapping, missing secret, failed liveness probe).
- Evidence: List specific lines or entries from the status, events, or logs above that back up your conclusion.
- Explanation: Explain the failure in simple terms for a beginner. Avoid heavy jargon without defining it first.
- Suggested Fix: Provide actionable, step-by-step commands or actions to fix this.
- Confidence: An integer from 0 to 100 representing how confident you are in the diagnosis.
- K8s Lesson: An object with two keys:
  - concept: The Kubernetes concept involved (e.g. 'CrashLoopBackOff', 'Liveness Probes').
  - analogy: A beginner-friendly real-world analogy explaining the concept.
"""
    return prompt.strip()


def build_concept_prompt(concept: str) -> str:
    """
    Constructs a prompt to explain a specific Kubernetes concept or resource type,
    enforcing guardrails to prevent answering out-of-scope queries.
    """
    return f"""
Explain the concept of '{concept}'.

GUARDRAILS & SCOPE LIMIT:
You are Podex, a dedicated Kubernetes, Docker, and container orchestration tutor. 
1. The requested concept '{concept}' MUST be directly related to Kubernetes, Docker, containerization, container registries, networking/security in containers, or cloud-native technologies.
2. If '{concept}' is completely unrelated to these topics (e.g., cooking, generic programming basics of unrelated languages like Java/Python, history, pop culture, gaming, general chat, or generic advice), you MUST decline to explain it.
3. In case of a denial, you must structure the JSON output of the ConceptExplanation schema as follows:
   - concept: Set this to "Out of Scope".
   - explanation: Provide a polite refusal message explaining that you are a Kubernetes/container tutor and cannot answer this topic. Keep it concise.
   - real_world_analogy: Set this to "N/A".
   - why_it_exists: Set this to "N/A".
   - common_gotchas: Return a single-item list containing: ["Please search for a topic related to Kubernetes or containerization."]

If the concept is in-scope, return your explanation matching the structure of the ConceptExplanation schema:
- concept: The name of the concept.
- explanation: A clear, beginner-friendly description using simple terms.
- real_world_analogy: An analogy that relates the concept to everyday life.
- why_it_exists: The problem it solves in Kubernetes and container orchestration.
- common_gotchas: Common pitfalls or mistakes beginners make when working with this concept.
"""


def json_to_yaml_like(data: Dict[str, Any], indent: int = 0) -> str:
    """
    Helper to turn a dictionary into a simple YAML-like string for clean prompt insertion.
    """
    lines = []
    spacing = "  " * indent
    if not isinstance(data, dict):
        return str(data)
        
    for k, v in data.items():
        if isinstance(v, dict):
            lines.append(f"{spacing}{k}:")
            lines.append(json_to_yaml_like(v, indent + 1))
        elif isinstance(v, list):
            lines.append(f"{spacing}{k}:")
            for item in v:
                if isinstance(item, dict):
                    lines.append(f"{spacing}-")
                    lines.append(json_to_yaml_like(item, indent + 2))
                else:
                    lines.append(f"{spacing}- {item}")
        else:
            lines.append(f"{spacing}{k}: {v}")
    return "\n".join(lines)
