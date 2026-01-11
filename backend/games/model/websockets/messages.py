from typing import Any
from pydantic import BaseModel

def to_camel(string: str) -> str:
    parts = string.split('_')
    return parts[0] + ''.join(word.capitalize() for word in parts[1:])

class WSMessage(BaseModel):
    class Config:
        alias_generator = to_camel
        populate_by_name = True

    def model_dump(self, *args: Any, **kwargs: Any) -> dict[str, Any]: 
        return super().model_dump(*args, **{**kwargs, "by_alias": True})
    
    def model_dump_json(self, *args: Any, **kwargs: Any) -> str: # type: ignore
        return super().model_dump_json(*args, **{**kwargs, "by_alias": True})
    
class WSServerMessage(WSMessage):
    ...

class WSPlayerMessage(WSMessage):
    ... 

