import json
from abc import ABC, abstractmethod
from typing import List, Optional, Dict
from pydantic import BaseModel, Field
from backend.config.settings import settings

# Pydantic models for structured AI output
class K8sLesson(BaseModel):
    concept: str = Field(description="The Kubernetes concept involved (e.g., 'CrashLoopBackOff', 'Liveness Probes').")
    analogy: str = Field(description="A beginner-friendly real-world analogy explaining the concept.")

class InvestigationResult(BaseModel):
    status: str = Field(description="Overall health status: 'healthy', 'degraded', or 'critical'.")
    root_cause: str = Field(description="The primary reason why the resource is failing or in its current state.")
    evidence: List[str] = Field(description="List of specific logs, events, or status indicators that support the root cause.")
    explanation: str = Field(description="A beginner-friendly explanation of the technical components and mechanisms involved in this failure.")
    suggested_fix: str = Field(description="Step-by-step instructions on how to resolve the issue (e.g. kubectl commands, YAML edits).")
    confidence: int = Field(description="Confidence percentage of the analysis (0-100).")
    k8s_lesson: K8sLesson = Field(description="Educational content explaining the underlying Kubernetes concepts involved.")

class ConceptExplanation(BaseModel):
    concept: str = Field(description="The Kubernetes concept being explained.")
    explanation: str = Field(description="Beginner-friendly explanation of the concept using analogies and simple terms.")
    real_world_analogy: str = Field(description="A relatable real-world analogy to help the beginner grasp the concept.")
    why_it_exists: str = Field(description="Why this resource or concept exists in Kubernetes.")
    common_gotchas: List[str] = Field(description="Common pitfalls or gotchas beginners face with this resource.")


class AIProvider(ABC):
    @abstractmethod
    async def investigate(self, context_prompt: str) -> InvestigationResult:
        pass

    @abstractmethod
    async def explain_concept(self, concept: str) -> ConceptExplanation:
        pass

    @abstractmethod
    async def explain_command(self, command: str, output: str) -> str:
        pass

    @abstractmethod
    async def generate_command(self, prompt: str) -> str:
        pass


class GeminiProvider(AIProvider):
    def __init__(self, api_key: str, model: Optional[str] = None, temperature: Optional[float] = None):
        from google import genai
        from google.genai import types
        self.client = genai.Client(api_key=api_key)
        self.model = model or "gemini-2.5-flash"
        self.temperature = temperature if temperature is not None else 0.2
        self.types = types

    async def investigate(self, context_prompt: str) -> InvestigationResult:
        response = self.client.models.generate_content(
            model=self.model,
            contents=context_prompt,
            config=self.types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=InvestigationResult,
                temperature=self.temperature,
            ),
        )
        return InvestigationResult.model_validate_json(response.text)

    async def explain_concept(self, concept: str) -> ConceptExplanation:
        from backend.ai.prompts import build_concept_prompt
        concept_prompt = build_concept_prompt(concept)
        response = self.client.models.generate_content(
            model=self.model,
            contents=concept_prompt,
            config=self.types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ConceptExplanation,
                temperature=self.temperature + 0.2 if self.temperature <= 0.8 else 1.0,
            ),
        )
        return ConceptExplanation.model_validate_json(response.text)

    async def explain_command(self, command: str, output: str) -> str:
        prompt = f"""
You are Podex, a helpful Kubernetes workspace tutor for beginners.
The user executed the following command inside a container:
`{command}`

The command returned this output:
```
{output}
```

Please explain in 2-3 simple sentences what this command did and what the output means for a beginner Kubernetes learner. Keep it educational and concise.
"""
        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config=self.types.GenerateContentConfig(
                temperature=self.temperature,
            ),
        )
        return response.text

    async def generate_command(self, prompt: str) -> str:
        system_prompt = (
            "You are a DevOps assistant. Generate a single-line shell command "
            "suitable for execution inside a container. Return ONLY the raw command. "
            "Do not wrap it in markdown block, do not include any explanation."
        )
        response = self.client.models.generate_content(
            model=self.model,
            contents=f"{system_prompt}\n\nUser request: {prompt}",
            config=self.types.GenerateContentConfig(
                temperature=0.1,
            ),
        )
        return response.text.strip().replace("`", "")


class OpenAIProvider(AIProvider):
    def __init__(self, api_key: str, model: Optional[str] = None, temperature: Optional[float] = None):
        from openai import OpenAI
        self.client = OpenAI(api_key=api_key)
        self.model = model or "gpt-4o-mini"
        self.temperature = temperature if temperature is not None else 0.2

    async def investigate(self, context_prompt: str) -> InvestigationResult:
        response = self.client.beta.chat.completions.parse(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are Podex, an expert Kubernetes teaching mentor."},
                {"role": "user", "content": context_prompt}
            ],
            response_format=InvestigationResult,
            temperature=self.temperature,
        )
        return response.choices[0].message.parsed

    async def explain_concept(self, concept: str) -> ConceptExplanation:
        from backend.ai.prompts import build_concept_prompt
        concept_prompt = build_concept_prompt(concept)
        response = self.client.beta.chat.completions.parse(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are Podex, an expert Kubernetes teaching mentor."},
                {"role": "user", "content": concept_prompt}
            ],
            response_format=ConceptExplanation,
            temperature=self.temperature + 0.2 if self.temperature <= 0.8 else 1.0,
        )
        return response.choices[0].message.parsed

    async def explain_command(self, command: str, output: str) -> str:
        prompt = f"""
The user executed the following command inside a container:
`{command}`

The command returned this output:
```
{output}
```

Please explain in 2-3 simple sentences what this command did and what the output means for a beginner Kubernetes learner. Keep it educational and concise.
"""
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are Podex, a helpful Kubernetes workspace tutor for beginners."},
                {"role": "user", "content": prompt}
            ],
            temperature=self.temperature,
        )
        return response.choices[0].message.content

    async def generate_command(self, prompt: str) -> str:
        system_prompt = (
            "You are a DevOps assistant. Generate a single-line shell command "
            "suitable for execution inside a container. Return ONLY the raw command. "
            "Do not wrap it in markdown block, do not include any explanation."
        )
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
        )
        return response.choices[0].message.content.strip().replace("`", "")


class MockProvider(AIProvider):
    """
    Mock AI Provider to run the app in Sandbox Mode when no API keys are provided.
    Helps beginners play with the tool without immediate setup.
    """
    async def investigate(self, context_prompt: str) -> InvestigationResult:
        return InvestigationResult(
            status="degraded",
            root_cause="Mock Mode: Gemini/OpenAI API key was not detected in settings or environment variables.",
            evidence=[
                "Settings: AI_PROVIDER set, but credentials missing.",
                "Environment: Check GEMINI_API_KEY or OPENAI_API_KEY in docker-compose.yml."
            ],
            explanation=(
                "To get real Kubernetes diagnostics, please supply an API key in your docker-compose.yml file. "
                "In Mock Mode, we generate static educational responses based on your cluster resource context."
            ),
            suggested_fix=(
                "1. Open `docker-compose.yml` or `.env`.\n"
                "2. Set the `GEMINI_API_KEY` or `OPENAI_API_KEY` environment variable.\n"
                "3. Restart the workspace."
            ),
            confidence=85,
            k8s_lesson=K8sLesson(
                concept="Kubernetes Observability",
                analogy="Think of observability like a car dashboard  Conditions are warning lights, Events are the trip log, and Logs are the engine diagnostics printout. Podex reads all three to diagnose issues."
            )
        )

    async def explain_concept(self, concept: str) -> ConceptExplanation:
        # Simple rule-based explanation for standard concepts if key is missing
        concept_lower = concept.lower().strip()
        
        # Guardrail check for MockProvider
        in_scope_keywords = [
            "pod", "deployment", "service", "ingress", "replica", "volume", 
            "namespace", "kubernetes", "k8s", "docker", "container", 
            "kubelet", "probe", "configmap", "secret"
        ]
        
        # Check if the query matches any container/Kubernetes keywords
        is_in_scope = any(kw in concept_lower for kw in in_scope_keywords)
        
        if not is_in_scope:
            return ConceptExplanation(
                concept="Out of Scope",
                explanation=f"I am Podex, your Kubernetes/container tutor. I cannot explain '{concept}' because it is not related to Kubernetes, containers, or Docker.",
                real_world_analogy="N/A",
                why_it_exists="N/A",
                common_gotchas=["Please search for a topic related to Kubernetes or containerization."]
            )
            
        if "pod" in concept_lower:
            return ConceptExplanation(
                concept="Pod",
                explanation="A Pod is the smallest, most basic deployable unit in Kubernetes. It represents a single instance of a running process in your cluster.",
                real_world_analogy="Think of a Pod as a shipping container. Inside it, you can put a single application (like a web server) and maybe a supporting sidecar (like a logger).",
                why_it_exists="Kubernetes manages containers, but doing so directly is complex. Pods group tightly-coupled containers together, allowing them to share networks, storage, and life cycles.",
                common_gotchas=[
                    "Pods are mortal. When they die, they don't resurrect. Deployments manage resurrection.",
                    "Containers in the same Pod share localhost port space, so they cannot bind to the same port."
                ]
            )
        elif "deployment" in concept_lower:
            return ConceptExplanation(
                concept="Deployment",
                explanation="A Deployment manages a set of identical Pods. It ensures they stay running, scales them up or down, and updates them safely when you deploy new code.",
                real_world_analogy="Think of a Deployment as a factory supervisor. You tell the supervisor 'I want 3 identical workers running at all times'. If one worker falls ill, the supervisor hires a new one.",
                why_it_exists="Because Pods are ephemeral, you shouldn't create them directly. A Deployment automates Pod scaling, rollout updates, and self-healing.",
                common_gotchas=[
                    "Updating a Deployment creates a new ReplicaSet. If the update fails, the old ReplicaSet remains active so the app stays up.",
                    "Scaling to 0 is a valid way to stop an application without deleting its configuration."
                ]
            )
        elif "service" in concept_lower:
            return ConceptExplanation(
                concept="Service",
                explanation="A Service is an abstract way to expose an application running on a set of Pods as a network service. It acts as a stable entry point and load balancer.",
                real_world_analogy="Think of a Service as a phone switchboard. Instead of calling a specific worker (a Pod) directly, you call the switchboard. The switchboard connects you to any available worker.",
                why_it_exists="Pods have dynamic, changing IP addresses. A Service gives your group of Pods a single permanent IP and DNS name, so clients don't lose connection when Pods restart.",
                common_gotchas=[
                    "Services find Pods using label selectors. If the selectors don't match the Pod labels exactly, no traffic will route.",
                    "A ClusterIP service is only accessible within the cluster. Use NodePort or LoadBalancer to access it externally."
                ]
            )
        else:
            return ConceptExplanation(
                concept=concept.title(),
                explanation=f"This is the Kubernetes concept of a {concept.title()}. To get a rich AI-powered explanation, configure your Gemini/OpenAI API key.",
                real_world_analogy="Think of it as a specialized tool in a toolbox that performs one job very well.",
                why_it_exists="It is designed to solve a specific infrastructure problem in modern container orchestration.",
                common_gotchas=[
                    "Ensure labels match correctly.",
                    "Refer to the official Kubernetes documentation for structural schemas."
                ]
            )

    async def explain_command(self, command: str, output: str) -> str:
        command_clean = command.strip().lower()
        if "ls" in command_clean:
            return (
                "Mock Explanation: You ran 'ls'. This command lists files in the current working directory "
                "inside the container. It helps verify what application source code, assets, or config files "
                "are loaded inside the container filesystem."
            )
        elif "pwd" in command_clean:
            return (
                "Mock Explanation: You ran 'pwd' (Print Working Directory). It returns the absolute path "
                "of the directory you are currently working in inside the container's isolated namespace."
            )
        elif "env" in command_clean:
            return (
                "Mock Explanation: You ran 'env'. This displays all environment variables active in the container. "
                "In Kubernetes, environment variables are populated from your container spec, ConfigMaps, or Secrets."
            )
        else:
            return (
                f"Mock Explanation: You ran '{command}'. This shell command executed successfully inside the container environment. "
                "In Kubernetes, containers provide an isolated runtime with their own shell context, let you query files, processes, and tools."
            )

    async def generate_command(self, prompt: str) -> str:
        p_lower = prompt.lower().strip()
        if "list" in p_lower or "file" in p_lower:
            return "ls -la"
        elif "process" in p_lower or "running" in p_lower:
            return "ps aux"
        elif "env" in p_lower or "environment" in p_lower:
            return "env"
        elif "network" in p_lower or "port" in p_lower or "listen" in p_lower:
            return "netstat -tuln || ss -tuln"
        elif "ip" in p_lower or "address" in p_lower:
            return "ip addr || ifconfig"
        elif "ping" in p_lower:
            return "ping -c 4 google.com"
        elif "curl" in p_lower or "request" in p_lower:
            return "curl -I http://localhost"
        else:
            return f"echo 'Mock Command for: {prompt}'"


def get_ai_provider(
    provider_override: Optional[str] = None, 
    api_key_override: Optional[str] = None,
    model_override: Optional[str] = None,
    temperature_override: Optional[float] = None
) -> AIProvider:
    """
    Factory function to retrieve the configured AI provider.
    """
    provider_name = (provider_override or settings.ai_provider or "gemini").lower()
    
    if provider_name == "gemini":
        key = api_key_override or settings.gemini_api_key
        if key:
            try:
                return GeminiProvider(key, model=model_override, temperature=temperature_override)
            except ImportError:
                print("Warning: google-genai is not installed properly. Falling back to Mock.")
    elif provider_name == "openai":
        key = api_key_override or settings.openai_api_key
        if key:
            try:
                return OpenAIProvider(key, model=model_override, temperature=temperature_override)
            except ImportError:
                print("Warning: openai is not installed properly. Falling back to Mock.")
            
    # Default fallback to Mock Sandbox Provider
    return MockProvider()
