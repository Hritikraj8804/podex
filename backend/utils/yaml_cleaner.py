from typing import Any

def clean_kubernetes_dict(d: Any) -> Any:
    """
    Recursively cleans a dictionary representing a Kubernetes resource:
    1. Removes keys with None/null values.
    2. Removes system-only metadata fields (like 'managedFields', 'uid', 'resourceVersion', 'generation', 'selfLink').
    3. Removes boilerplate fields to make it beginner-friendly and clean for learning.
    4. Removes empty dicts and lists resulting from cleanup.
    """
    if isinstance(d, list):
        cleaned_list = []
        for item in d:
            # Filter out default injected serviceaccount volumes/mounts and system tolerations
            if isinstance(item, dict):
                mount_path = item.get("mountPath", "")
                if mount_path.startswith("/var/run/secrets/kubernetes.io/serviceaccount") or "kube-api-access" in item.get("name", ""):
                    continue
                if "kube-api-access" in item.get("name", ""):
                    continue
                if item.get("key") in ("node.kubernetes.io/not-ready", "node.kubernetes.io/unreachable"):
                    continue
            
            cleaned_item = clean_kubernetes_dict(item)
            if cleaned_item is not None and cleaned_item != {} and cleaned_item != []:
                cleaned_list.append(cleaned_item)
        return cleaned_list
        
    if isinstance(d, dict):
        cleaned_dict = {}
        for k, v in d.items():
            if v is None:
                continue
            
            # Beginner-friendly filter rules: remove verbose system boilerplate
            if k in (
                "managedFields", 
                "resourceVersion", 
                "uid", 
                "generation", 
                "selfLink", 
                "kubectl.kubernetes.io/last-applied-configuration",
                "terminationMessagePath",
                "terminationMessagePolicy",
                "dnsPolicy",
                "enableServiceLinks",
                "preemptionPolicy",
                "priority",
                "schedulerName",
                "terminationGracePeriodSeconds",
                "observedGeneration",
                "qosClass",
                "containerID",
                "imageID",
                "user",
                "hostIP",
                "hostIPs",
                "podIP",
                "podIPs",
                "ownerReferences",
                "nodeName"
            ):
                continue
                
            cleaned_val = clean_kubernetes_dict(v)
            if cleaned_val is None or cleaned_val == {} or cleaned_val == []:
                continue
                
            cleaned_dict[k] = cleaned_val
        return cleaned_dict

    return d
