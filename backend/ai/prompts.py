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
- Root Cause: Pinpoint the exact issue (e.g. ImagePullBackOff, wrong Port mapping, missing secret, failed liveness probe).
- Evidence: List specific lines or entries from the status, events, or logs above that back up your conclusion.
- Explanation: Explain the failure in simple terms for a beginner. Avoid heavy jargon without defining it first.
- Suggested Fix: Provide actionable, step-by-step commands or actions to fix this.
- Learning: Write a short paragraph explaining the core Kubernetes concept involved so the user learns why this happened and how Kubernetes works.
- Confidence: Choose High, Medium, or Low with a 1-sentence reason.
"""
    return prompt.strip()


def build_concept_prompt(concept: str) -> str:
    """
    Constructs a prompt to explain a specific Kubernetes concept or resource type.
    """
    return f"""
Explain the Kubernetes concept of '{concept}' in a way that a absolute beginner developer, student, or someone moving from basic Docker containerization can easily understand.

Return your explanation matching the structure of the ConceptExplanation schema:
- Concept: The name of the concept.
- Explanation: A clear, beginner-friendly description using simple terms.
- Real World Analogy: An analogy that relates the concept to everyday life.
- Why It Exists: The problem it solves in Kubernetes and container orchestration.
- Common Gotchas: Common pitfalls or mistakes beginners make when working with this concept.
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
