
# GameWSServerStateMessage


## Properties

Name | Type
------------ | -------------
`ownShipGrid` | [View](View.md)
`opponentShipGrid` | [View](View.md)

## Example

```typescript
import type { GameWSServerStateMessage } from ''

// TODO: Update the object below with actual values
const example = {
  "ownShipGrid": null,
  "opponentShipGrid": null,
} satisfies GameWSServerStateMessage

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as GameWSServerStateMessage
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


