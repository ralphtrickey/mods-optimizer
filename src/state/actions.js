import {modSets, modSlots, modStats} from "../constants/enums";
import cleanAllyCode from "../utils/cleanAllyCode";
import {PlayerValues} from "../domain/CharacterDataClasses";

export const CHANGE_SECTION = 'CHANGE_SECTION';
export const REQUEST_PROFILE = 'REQUEST_PROFILE';
export const RECEIVE_PROFILE = 'RECEIVE_PROFILE';
export const REQUEST_CHARACTERS = 'REQUEST_CHARACTERS';
export const RECEIVE_CHARACTERS = 'RECEIVE_CHARACTERS';
export const REQUEST_STATS = 'REQUEST_STATS';
export const RECEIVE_STATS = 'RECEIVE_STATS';
export const LOG = 'LOG';

export function logState() {
  return {
    type: LOG
  };
}

export function changeSection(newSection) {
  return {
    type: CHANGE_SECTION,
    section: newSection
  };
}

export function requestProfile(allyCode) {
  return {
    type: REQUEST_PROFILE,
    allyCode: allyCode
  };
}

export function receiveProfile(allyCode, profile) {
  return {
    type: RECEIVE_PROFILE,
    allyCode: allyCode,
    profile: profile
  };
}

export function requestCharacters() {
  return {
    type: REQUEST_CHARACTERS
  };
}

export function receiveCharacters(characters) {
  return {
    type: RECEIVE_CHARACTERS,
    characters: characters
  };
}

/**
 * Request the base and equipped stats for a list of characters
 * @returns {{type: string}}
 */
export function requestStats() {
  return {
    type: REQUEST_STATS
  };
}

/**
 * Handle the receipt of base and equipped stats for a list of characters
 * @param allyCode String
 * @param characterStats Object{Character.baseID: {baseStats: CharacterStats, equippedStats: CharacterStats}}
 * @returns {{type: string, allyCode: string, stats: *}}
 */
export function receiveStats(allyCode, characterStats) {
  return {
    type: RECEIVE_STATS,
    allyCode: allyCode,
    stats: characterStats
  }
}

function post(url='', data={}, extras={}) {
  return fetch(url, Object.assign({
    method: 'POST',
    headers: {'Accept': 'application/json', 'Content-Type': 'application/json'},
    body: JSON.stringify(data),
    mode: "cors",
  }, extras)).then(response => response.json());
}

function dispatchFetchCharacters(dispatch) {
  dispatch(requestCharacters());
  return fetch('https://api.mods-optimizer.swgoh.grandivory.com/characters/')
    .then(response => response.json())
    .then(characters => {console.log(characters); return characters;})
    .then(characters => {dispatch(receiveCharacters(characters)); return characters;})
}

function dispatchFetchProfile(dispatch, allyCode) {
  dispatch(requestProfile(allyCode));
  return post(
    'https://api.mods-optimizer.swgoh.grandivory.com/playerprofile/',
    {'ally-code': allyCode}
  )
    .then(
      playerProfile => {
        const roster = playerProfile.roster.filter(entry => entry.type === 'CHARACTER');

        // Convert mods to the serialized format recognized by the optimizer
        const profileMods = roster.map(character =>
          character.mods.map(mod => {
            mod.characterID = character.defId;
            mod.mod_uid = mod.id;
            mod.set = modSets[mod.set];
            mod.slot = modSlots[mod.slot];
            mod.primaryBonusType = modStats[mod.primaryBonusType];
            for (let i = 1; i <= 4; i++) {
              mod[`secondaryType_${i}`] = modStats[mod[`secondaryType_${i}`]];
            }
            return mod;
          }))
          .reduce((allMods, charMods) => allMods.concat(charMods), []);

        // Convert each character to a PlayerValues object
        const profileCharacters = roster.reduce((characters, character) => {
          characters[character.defId] = new PlayerValues(
            character.level,
            character.rarity,
            character.gear,
            character.equipped.map(gear => {return {equipmentId: gear.equipmentId};}),
            character.gp
          );
          return characters;
        }, {});

        return {
          mods: profileMods,
          characters: profileCharacters
        };
      },
      error => console.dir(error)
    )
    .then(profile => {
      dispatch(receiveProfile(allyCode, profile));
      return profile;
    });
}

function dispatchFetchCharacterStats(dispatch, allyCode, characters) {
  console.dir(characters);
  dispatch(requestStats());
  return post(
    'https://crinolo-swgoh.glitch.me/statCalc/api/characters',
    Object.keys(characters).map(charID => {
      return {
        'defId': charID,
        'rarity': characters[charID].stars,
        'level': characters[charID].level,
        'gear': characters[charID].gearLevel,
        'equipped': characters[charID].gearPieces
      };
    })
  )
    .then(statsResponse => {console.dir(statsResponse); return statsResponse;})
    .then(statsResponse => {dispatch(receiveStats(allyCode, statsResponse)); return statsResponse;});
}

export function refreshPlayerData(allyCode) {
  const cleanedAllyCode = cleanAllyCode(allyCode);

  return function(dispatch) {
    return dispatchFetchCharacters(dispatch, cleanedAllyCode)
      .then(() => dispatchFetchProfile(dispatch, cleanedAllyCode))
      .then(profile => dispatchFetchCharacterStats(dispatch, cleanedAllyCode, profile.characters));
  }
}

/**
 * Asynchronously fetch the set of all characters from swgoh.gg
 *
 * @param allyCode string The ally code under which to store the character information
 */
export function fetchCharacters(allyCode) {
  const cleanedAllyCode = cleanAllyCode(allyCode);

  return function(dispatch) {
    return dispatchFetchCharacters(dispatch, cleanedAllyCode);
  }
}

/**
 * Asynchronously fetch a player's profile, updating state before the fetch to show that the app is busy, and after
 * the fetch to fill in with the response
 *
 * @param allyCode string The ally code to fetch a profile for
 */
export function fetchProfile(allyCode) {
  const cleanedAllyCode = cleanAllyCode(allyCode);

  return function (dispatch) {
    return dispatchFetchProfile(dispatch, cleanedAllyCode);
  }
}

export function fetchCharacterStats(allyCode, characters) {
  const cleanedAllyCode = cleanAllyCode(allyCode);

  return function(dispatch) {
    return dispatchFetchCharacterStats(dispatch, cleanedAllyCode, characters);
  }
}
