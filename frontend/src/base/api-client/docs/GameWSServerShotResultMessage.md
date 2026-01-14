
# GameWSGameServerShotResultMessageMessage


## Properties

Name | Type
------------ | -------------
`row` | number
`col` | number
`hit` | boolean
`sunkShip` | [Ship](Ship.md)

## Example

```typescript
import type { GameWSGameServerShotResultMessageMessage } from ''

// TODO: Update the object below with actual values
const example = {
  "row": null,
  "col": null,
  "hit": null,
  "sunkShip": null,
} satisfies GameWSGameServerShotResultMessageMessage

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as GameWSGameServerShotResultMessageMessage
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


