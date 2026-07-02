from typing import Any, Dict

def clean_kubernetes_dict(d: Any) -> Any:
    """
    Recursively cleans the dictionary representation of a Kubernetes resource:
    1. Removes keys with None/null values.
    2. Removes system-only metadata fields (like 'managedFields', 'uid', 'resourceVersion', 'generation', 'selfLink').
    3. Removes empty dicts and lists resulting from cleanup.
    """
    if isinstance(d, list):
        cleaned_list = [clean_kubernetes_dict(v) for v in d]
        # Return list omitting empty dict/list items
        return [v for v in cleaned_list if v is not None and v != {} and v != []]
        
    if isinstance(d, dict):
        cleaned_dict = {}
        for k, v in d.items():
            # Skip keys with None/null values
            if v is None:
                continue
            # Skip highly verbose system-managed metadata fields and configurations
            if k in (
                "managedFields", 
                "resourceVersion", 
                "uid", 
                "generation", 
                "selfLink", 
                "kubectl.kubernetes.io/last-applied-configuration"
            ):
                continue
                
            cleaned_val = clean_kubernetes_dict(v)
            # Skip empty structures resulting from cleanup
            if cleaned_val is None or cleaned_val == {} or cleaned_val == []:
                continue
                
            cleaned_dict[k] = cleaned_val
        return cleaned_dict

    return d
