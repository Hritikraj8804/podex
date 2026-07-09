import yaml
from fastapi import APIRouter, HTTPException, Query, Header
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

from backend.services.k8s_service import K8sService
from backend.services.investigation_service import InvestigationService
from backend.ai import get_ai_provider, build_concept_prompt, InvestigationResult, ConceptExplanation
from backend.kubernetes.client import list_contexts, switch_context
from backend.utils import clean_kubernetes_dict

router = APIRouter()
k8s_service = K8sService()
investigation_service = InvestigationService()

# Request schemas
class InvestigateRequest(BaseModel):
    type: str  # 'pod', 'deployment', or 'service'
    name: str
    namespace: str

class ScaleRequest(BaseModel):
    namespace: str
    name: str
    replicas: int

class RestartRequest(BaseModel):
    namespace: str
    name: str

class DeleteRequest(BaseModel):
    namespace: str
    name: str

class SwitchContextRequest(BaseModel):
    context: str

class ExecRequest(BaseModel):
    container: str
    command: str

class ExplainCommandRequest(BaseModel):
    command: str
    output: str

class ExplainCommandResponse(BaseModel):
    explanation: str

# 1. Dashboard Stats
@router.get("/stats")
def get_stats():
    return k8s_service.get_cluster_stats()

# 2. Explorer Lists
@router.get("/pods")
def get_pods(namespace: Optional[str] = Query(None)):
    return k8s_service.list_pods(namespace)

@router.get("/deployments")
def get_deployments(namespace: Optional[str] = Query(None)):
    return k8s_service.list_deployments(namespace)

@router.get("/services")
def get_services(namespace: Optional[str] = Query(None)):
    return k8s_service.list_services(namespace)

@router.get("/resources")
def get_resources(namespace: Optional[str] = Query(None)):
    try:
        return {
            "pods": k8s_service.list_pods(namespace),
            "deployments": k8s_service.list_deployments(namespace),
            "services": k8s_service.list_services(namespace)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 3. Resource Tabs
@router.get("/{resource_type}/{namespace}/{name}/details")
def get_details(resource_type: str, namespace: str, name: str):
    rt = resource_type.lower()
    try:
        if rt == "pod":
            return k8s_service.get_pod_details(namespace, name)
        elif rt == "deployment":
            return k8s_service.get_deployment_details(namespace, name)
        elif rt == "service":
            return k8s_service.get_service_details(namespace, name)
        else:
            raise HTTPException(status_code=400, detail=f"Invalid resource type: {resource_type}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{resource_type}/{namespace}/{name}/yaml")
def get_yaml(resource_type: str, namespace: str, name: str):
    rt = resource_type.lower()
    try:
        if rt == "pod":
            data = k8s_service.get_pod_details(namespace, name)
        elif rt == "deployment":
            data = k8s_service.get_deployment_details(namespace, name)
        elif rt == "service":
            data = k8s_service.get_service_details(namespace, name)
        else:
            raise HTTPException(status_code=400, detail=f"Invalid resource type: {resource_type}")
        
        # Clean Kubernetes dict to remove system fields and null values
        cleaned_data = clean_kubernetes_dict(data)
        yaml_str = yaml.dump(cleaned_data, default_flow_style=False)
        return {"yaml": yaml_str}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{resource_type}/{namespace}/{name}/logs")
def get_logs(resource_type: str, namespace: str, name: str, tail: int = 100, timestamps: bool = False):
    rt = resource_type.lower()
    try:
        if rt == "pod":
            return {"logs": k8s_service.get_pod_logs(namespace, name, tail_lines=tail, timestamps=timestamps)}
        elif rt == "deployment":
            return {"logs": k8s_service.get_deployment_logs(namespace, name, tail_lines=tail, timestamps=timestamps)}
        elif rt == "service":
            return {"logs": k8s_service.get_service_logs(namespace, name, tail_lines=tail, timestamps=timestamps)}
        else:
            raise HTTPException(status_code=400, detail=f"Invalid resource type: {resource_type}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{resource_type}/{namespace}/{name}/events")
def get_events(resource_type: str, namespace: str, name: str):
    return k8s_service.get_resource_events(namespace, name, resource_type)

# 4. Investigate Endpoint
@router.post("/investigate", response_model=InvestigationResult)
async def investigate(
    req: InvestigateRequest,
    x_ai_provider: Optional[str] = Header(None),
    x_ai_key: Optional[str] = Header(None),
    x_ai_model: Optional[str] = Header(None),
    x_ai_temperature: Optional[float] = Header(None)
):
    return await investigation_service.investigate_resource(
        resource_type=req.type,
        name=req.name,
        namespace=req.namespace,
        provider_override=x_ai_provider,
        api_key_override=x_ai_key,
        model_override=x_ai_model,
        temperature_override=x_ai_temperature
    )

# 5. Concept Learning Endpoint
@router.get("/learn", response_model=ConceptExplanation)
async def learn_concept(
    concept: str = Query(..., description="The Kubernetes resource or topic to explain"),
    x_ai_provider: Optional[str] = Header(None),
    x_ai_key: Optional[str] = Header(None),
    x_ai_model: Optional[str] = Header(None),
    x_ai_temperature: Optional[float] = Header(None)
):
    ai_provider = get_ai_provider(
        provider_override=x_ai_provider,
        api_key_override=x_ai_key,
        model_override=x_ai_model,
        temperature_override=x_ai_temperature
    )
    return await ai_provider.explain_concept(concept)

# 6. Operations (Restart, Scale, Delete)
@router.post("/operations/scale")
def scale_resource(req: ScaleRequest):
    result = k8s_service.scale_deployment(req.namespace, req.name, req.replicas)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("message"))
    return result

@router.post("/operations/restart")
def restart_resource(req: RestartRequest):
    result = k8s_service.restart_deployment(req.namespace, req.name)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("message"))
    return result

@router.post("/operations/delete")
def delete_resource(req: DeleteRequest):
    result = k8s_service.delete_pod(req.namespace, req.name)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("message"))
    return result

# 7. Kubeconfig Context Switchers
@router.get("/kube/contexts")
def get_kube_contexts():
    return list_contexts()

@router.post("/kube/switch")
def post_switch_context(req: SwitchContextRequest):
    success = switch_context(req.context)
    if not success:
        raise HTTPException(status_code=500, detail=f"Failed to switch to context: {req.context}")
    return {"success": True, "message": f"Successfully switched to context: {req.context}"}

# 8. Interactive Container Exec
@router.post("/pods/{namespace}/{name}/exec")
def execute_command(namespace: str, name: str, req: ExecRequest):
    result = k8s_service.execute_pod_command(
        namespace=namespace,
        name=name,
        container=req.container,
        command=req.command
    )
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error"))
    return result

@router.post("/pods/explain-command", response_model=ExplainCommandResponse)
async def post_explain_command(
    req: ExplainCommandRequest,
    x_ai_provider: Optional[str] = Header(None),
    x_ai_key: Optional[str] = Header(None),
    x_ai_model: Optional[str] = Header(None),
    x_ai_temperature: Optional[float] = Header(None)
):
    ai_provider = get_ai_provider(
        provider_override=x_ai_provider,
        api_key_override=x_ai_key,
        model_override=x_ai_model,
        temperature_override=x_ai_temperature
    )
    explanation = await ai_provider.explain_command(req.command, req.output)
    return {"explanation": explanation}
