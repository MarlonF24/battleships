from typing import Any
from ..model import Base

class WSMessage(Base):

    def model_dump(self, *args: Any, **kwargs: Any) -> dict[str, Any]: 
        return super().model_dump(*args, **{**kwargs, "by_alias": True})
    
    def model_dump_json(self, *args: Any, **kwargs: Any) -> str: # type: ignore
        return super().model_dump_json(*args, **{**kwargs, "by_alias": True})
    
class WSServerMessage(WSMessage):
    ...

class WSPlayerMessage(WSMessage):
    ... 

