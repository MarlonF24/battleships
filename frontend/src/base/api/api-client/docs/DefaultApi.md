# DefaultApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createGameGamesCreatePost**](DefaultApi.md#creategamegamescreatepost) | **POST** /games/create | Create Game |
| [**createPlayerPlayersCreatePost**](DefaultApi.md#createplayerplayerscreatepost) | **POST** /players/create | Create Player |
| [**getGameParamsGamesGameIdParamsGet**](DefaultApi.md#getgameparamsgamesgameidparamsget) | **GET** /games/{gameId}/params | Get Game Params |
| [**getGamePhaseGamesGameIdPhaseGet**](DefaultApi.md#getgamephasegamesgameidphaseget) | **GET** /games/{gameId}/phase | Get Game Phase |
| [**joinGameGamesGameIdJoinPost**](DefaultApi.md#joingamegamesgameidjoinpost) | **POST** /games/{gameId}/join | Join Game |
| [**welcomeFullPathGet**](DefaultApi.md#welcomefullpathget) | **GET** /{full_path} | Welcome |



## createGameGamesCreatePost

> string createGameGamesCreatePost(playerId, pregameParams)

Create Game

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { CreateGameGamesCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // string
    playerId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // PregameParams
    pregameParams: ...,
  } satisfies CreateGameGamesCreatePostRequest;

  try {
    const data = await api.createGameGamesCreatePost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **playerId** | `string` |  | [Defaults to `undefined`] |
| **pregameParams** | [PregameParams](PregameParams.md) |  | |

### Return type

**string**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## createPlayerPlayersCreatePost

> string createPlayerPlayersCreatePost(playerId)

Create Player

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { CreatePlayerPlayersCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // string (optional)
    playerId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies CreatePlayerPlayersCreatePostRequest;

  try {
    const data = await api.createPlayerPlayersCreatePost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **playerId** | `string` |  | [Optional] [Defaults to `undefined`] |

### Return type

**string**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getGameParamsGamesGameIdParamsGet

> GameParams getGameParamsGamesGameIdParamsGet(gameId, playerId)

Get Game Params

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { GetGameParamsGamesGameIdParamsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // string
    gameId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string
    playerId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies GetGameParamsGamesGameIdParamsGetRequest;

  try {
    const data = await api.getGameParamsGamesGameIdParamsGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **gameId** | `string` |  | [Defaults to `undefined`] |
| **playerId** | `string` |  | [Defaults to `undefined`] |

### Return type

[**GameParams**](GameParams.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getGamePhaseGamesGameIdPhaseGet

> GamePhase getGamePhaseGamesGameIdPhaseGet(gameId, playerId)

Get Game Phase

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { GetGamePhaseGamesGameIdPhaseGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // string
    gameId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string
    playerId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies GetGamePhaseGamesGameIdPhaseGetRequest;

  try {
    const data = await api.getGamePhaseGamesGameIdPhaseGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **gameId** | `string` |  | [Defaults to `undefined`] |
| **playerId** | `string` |  | [Defaults to `undefined`] |

### Return type

[**GamePhase**](GamePhase.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## joinGameGamesGameIdJoinPost

> GamePhase joinGameGamesGameIdJoinPost(gameId, playerId)

Join Game

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { JoinGameGamesGameIdJoinPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // string
    gameId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string
    playerId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies JoinGameGamesGameIdJoinPostRequest;

  try {
    const data = await api.joinGameGamesGameIdJoinPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **gameId** | `string` |  | [Defaults to `undefined`] |
| **playerId** | `string` |  | [Defaults to `undefined`] |

### Return type

[**GamePhase**](GamePhase.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## welcomeFullPathGet

> any welcomeFullPathGet(fullPath)

Welcome

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { WelcomeFullPathGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // string
    fullPath: fullPath_example,
  } satisfies WelcomeFullPathGetRequest;

  try {
    const data = await api.welcomeFullPathGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **fullPath** | `string` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

