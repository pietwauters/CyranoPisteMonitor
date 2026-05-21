/**
 * opp2.js - OpenPiste Protocol Level 2 (OPP2) JavaScript Library
 * 
 * A JavaScript port of the C++ OPP2 library for web-based displays and tools.
 * Provides topic parsing, message deserialization, and callback dispatching.
 * 
 * SPDX-License-Identifier: MIT
 */

(function(global) {
  'use strict';

  const OPP2 = {};

  // ============================================================================
  // Constants
  // ============================================================================

  OPP2.PROTOCOL_ID = 'OPP2';
  OPP2.PROTOCOL_VERSION = '1.0';
  OPP2.TOPIC_PREFIX = 'openpiste';

  // ============================================================================
  // Enumerations
  // ============================================================================

  OPP2.Publisher = {
    APPARATUS: 'apparatus',
    SOFTWARE: 'software',
    REMOTE: 'remote',
    UNKNOWN: 'unknown'
  };

  OPP2.MessageType = {
    LIGHTS: 'lights',
    CLOCK: 'clock',
    BLADE_CONTACT: 'blade_contact',
    SCORE: 'score',
    CONNECTION: 'connection',
    APPARATUS_STATE: 'state',
    FENCERS: 'fencers',
    MATCH: 'match',
    UW2F: 'uw2f',
    MEDICAL: 'medical',
    VIDEO_REVIEW: 'video_review',
    CONTROL: 'control',
    UNKNOWN: 'unknown'
  };

  OPP2.ApparatusState = {
    FENCING: 'F',
    HALT: 'H',
    PAUSE: 'P',
    WAITING: 'W',
    ENDING: 'E',
    UNKNOWN: 'unknown'
  };

  OPP2.Priority = {
    NONE: 'N',
    RIGHT: 'R',
    LEFT: 'L',
    UNKNOWN: 'unknown'
  };

  OPP2.FencerStatus = {
    UNDEFINED: 'U',
    VICTORY: 'V',
    DEFEAT: 'D',
    ABANDONMENT: 'A',
    EXCLUSION: 'E',
    DNS: 'DNS',
    UNKNOWN: 'unknown'
  };

  OPP2.Weapon = {
    FOIL: 'F',
    EPEE: 'E',
    SABRE: 'S',
    UNKNOWN: 'unknown'
  };

  OPP2.Side = {
    LEFT: 'left',
    RIGHT: 'right',
    NONE: 'none'
  };

  OPP2.Command = {
    BEGIN: 'BEGIN',
    HALT: 'HALT',
    RESET: 'RESET',
    VALIDATE: 'VALIDATE',
    NEXT: 'NEXT',
    PREV: 'PREV',
    END: 'END',
    ACK: 'ACK',
    NAK: 'NAK',
    MEDICAL: 'MEDICAL',
    RESERVE: 'RESERVE',
    VIDEO_REVIEW_REQUEST: 'VIDEO_REVIEW_REQUEST',
    VIDEO_REVIEW_GRANTED: 'VIDEO_REVIEW_GRANTED',
    VIDEO_REVIEW_DENIED: 'VIDEO_REVIEW_DENIED',
    UNKNOWN: 'unknown'
  };

  // ============================================================================
  // Topic Parser
  // ============================================================================

  OPP2.TopicParser = {
    /**
     * Parse an MQTT topic string into its components
     * @param {string} topic - Full MQTT topic (e.g., "openpiste/17/apparatus/lights")
     * @returns {object|null} - {piste_id, publisher, message_type} or null if invalid
     */
    parse: function(topic) {
      if (!topic) return null;

      const segments = topic.split('/');
      if (segments.length !== 4) return null;

      const [prefix, pisteId, publisher, messageType] = segments;

      if (prefix !== OPP2.TOPIC_PREFIX) return null;
      if (!pisteId) return null;

      // Validate publisher and message type
      const validPublisher = Object.values(OPP2.Publisher).includes(publisher);
      const validMessageType = Object.values(OPP2.MessageType).includes(messageType);

      return {
        piste_id: pisteId,
        publisher: validPublisher ? publisher : OPP2.Publisher.UNKNOWN,
        message_type: validMessageType ? messageType : OPP2.MessageType.UNKNOWN
      };
    },

    /**
     * Build an MQTT topic string from components
     * @param {string} pisteId - Piste identifier
     * @param {string} publisher - Publisher role
     * @param {string} messageType - Message type
     * @returns {string} - Full MQTT topic
     */
    build: function(pisteId, publisher, messageType) {
      return `${OPP2.TOPIC_PREFIX}/${pisteId}/${publisher}/${messageType}`;
    }
  };

  // ============================================================================
  // Message Deserializer
  // ============================================================================

  OPP2.Deserializer = {
    /**
     * Deserialize a JSON payload into a message object
     * @param {string} messageType - Type of message to deserialize
     * @param {string} payload - JSON string
     * @returns {object|null} - Parsed message object or null on error
     */
    deserialize: function(messageType, payload) {
      try {
        const data = JSON.parse(payload);
        
        // Validate protocol
        if (data.protocol !== OPP2.PROTOCOL_ID) {
          console.warn('Invalid protocol:', data.protocol);
          return null;
        }

        // Route to specific deserializer
        switch (messageType) {
          case OPP2.MessageType.LIGHTS:
            return this.deserializeLights(data);
          case OPP2.MessageType.CLOCK:
            return this.deserializeClock(data);
          case OPP2.MessageType.BLADE_CONTACT:
            return this.deserializeBladeContact(data);
          case OPP2.MessageType.SCORE:
            return this.deserializeScore(data);
          case OPP2.MessageType.CONNECTION:
            return this.deserializeConnection(data);
          case OPP2.MessageType.APPARATUS_STATE:
            return this.deserializeApparatusState(data);
          case OPP2.MessageType.FENCERS:
            return this.deserializeFencers(data);
          case OPP2.MessageType.MATCH:
            return this.deserializeMatch(data);
          case OPP2.MessageType.UW2F:
            return this.deserializeUW2F(data);
          case OPP2.MessageType.MEDICAL:
            return this.deserializeMedical(data);
          case OPP2.MessageType.VIDEO_REVIEW:
            return this.deserializeVideoReview(data);
          case OPP2.MessageType.CONTROL:
            return this.deserializeControl(data);
          default:
            console.warn('Unknown message type:', messageType);
            return null;
        }
      } catch (e) {
        console.error('Deserialization error:', e);
        return null;
      }
    },

    deserializeLights: function(data) {
      return {
        protocol: data.protocol,
        version: data.version,
        seq: data.seq || 0,
        ts: data.ts || 0,
        left: {
          on_target: data.left?.red || false,
          white: data.left?.white || false
        },
        right: {
          on_target: data.right?.green || false,
          white: data.right?.white || false
        }
      };
    },

    deserializeClock: function(data) {
      return {
        protocol: data.protocol,
        version: data.version,
        ts: data.ts || 0,
        running: data.running || false,
        time_ms: data.time_ms || 0,
        time: data.time || '0:00'
      };
    },

    deserializeBladeContact: function(data) {
      return {
        protocol: data.protocol,
        version: data.version,
        ts: data.ts || 0,
        active: data.active || false
      };
    },

    deserializeScore: function(data) {
      return {
        protocol: data.protocol,
        version: data.version,
        seq: data.seq || 0,
        left: {
          score: data.left?.score || 0,
          status: data.left?.status || OPP2.FencerStatus.UNDEFINED,
          yellow_card: data.left?.yellow_card || false,
          red_cards: data.left?.red_cards || 0,
          black_card: data.left?.black_card || false
        },
        right: {
          score: data.right?.score || 0,
          status: data.right?.status || OPP2.FencerStatus.UNDEFINED,
          yellow_card: data.right?.yellow_card || false,
          red_cards: data.right?.red_cards || 0,
          black_card: data.right?.black_card || false
        },
        priority: data.priority || OPP2.Priority.NONE
      };
    },

    deserializeConnection: function(data) {
      return {
        protocol: data.protocol || OPP2.PROTOCOL_ID,
        version: data.version || OPP2.PROTOCOL_VERSION,
        seq: data.seq || 0,
        online: data.online || false,
        device: data.device || '',
        fw_version: data.fw_version || ''
      };
    },

    deserializeApparatusState: function(data) {
      return {
        protocol: data.protocol,
        version: data.version,
        seq: data.seq || 0,
        state: data.state || OPP2.ApparatusState.WAITING
      };
    },

    deserializeFencers: function(data) {
      const parsePerson = (p) => ({
        id: p?.id || '',
        name: p?.name || '',
        nation: p?.nation || ''
      });

      return {
        protocol: data.protocol,
        version: data.version,
        seq: data.seq || 0,
        left: {
          fencer: parsePerson(data.left?.fencer),
          coach: parsePerson(data.left?.coach)
        },
        right: {
          fencer: parsePerson(data.right?.fencer),
          coach: parsePerson(data.right?.coach)
        },
        referee: parsePerson(data.referee),
        video_official: parsePerson(data.video_official)
      };
    },

    deserializeMatch: function(data) {
      return {
        protocol: data.protocol,
        version: data.version,
        seq: data.seq || 0,
        weapon: data.weapon || OPP2.Weapon.UNKNOWN,
        type: data.type || 'I',
        competition: data.competition || '',
        phase_type: data.phase_type || '',
        phase: data.phase || '',
        poule: data.poule || '',
        match: data.match || 0,
        round: data.round || 1,
        scheduled: data.scheduled || ''
      };
    },

    deserializeUW2F: function(data) {
      return {
        protocol: data.protocol,
        version: data.version,
        seq: data.seq || 0,
        time_ms: data.time_ms || 0,
        time: data.time || '0:00',
        left: {
          p_card: data.left?.p_card || 0
        },
        right: {
          p_card: data.right?.p_card || 0
        }
      };
    },

    deserializeMedical: function(data) {
      return {
        protocol: data.protocol,
        version: data.version,
        seq: data.seq || 0,
        active: data.active || false,
        side: data.side || OPP2.Side.NONE,
        duration_ms: data.duration_ms || 0,
        remaining_ms: data.remaining_ms || 0,
        remaining: data.remaining || '0:00'
      };
    },

    deserializeVideoReview: function(data) {
      const parseSide = (s) => ({
        remaining: s?.remaining || 0,
        calls: s?.calls || [],
        call_count: s?.calls?.length || 0
      });

      return {
        protocol: data.protocol,
        version: data.version,
        seq: data.seq || 0,
        left: parseSide(data.left),
        right: parseSide(data.right)
      };
    },

    deserializeControl: function(data) {
      return {
        protocol: data.protocol,
        version: data.version,
        seq: data.seq || 0,
        ts: data.ts || 0,
        command: data.command || OPP2.Command.UNKNOWN,
        side: data.side || OPP2.Side.NONE,
        duration: data.duration || 0
      };
    }
  };

  // ============================================================================
  // System State
  // ============================================================================

  /**
   * SystemState - aggregated state of all retained topics for one piste
   */
  OPP2.SystemState = function() {
    this.piste_id = '';
    this.lights = null;
    this.clock = null;
    this.score = null;
    this.connection = null;
    this.apparatus_state = null;
    this.fencers = null;
    this.match = null;
    this.uw2f = null;
    this.medical = null;
    this.video_review = null;
  };

  OPP2.SystemState.prototype.update = function(messageType, message) {
    switch (messageType) {
      case OPP2.MessageType.LIGHTS:
        this.lights = message;
        break;
      case OPP2.MessageType.CLOCK:
        this.clock = message;
        break;
      case OPP2.MessageType.SCORE:
        this.score = message;
        break;
      case OPP2.MessageType.CONNECTION:
        this.connection = message;
        break;
      case OPP2.MessageType.APPARATUS_STATE:
        this.apparatus_state = message;
        break;
      case OPP2.MessageType.FENCERS:
        this.fencers = message;
        break;
      case OPP2.MessageType.MATCH:
        this.match = message;
        break;
      case OPP2.MessageType.UW2F:
        this.uw2f = message;
        break;
      case OPP2.MessageType.MEDICAL:
        this.medical = message;
        break;
      case OPP2.MessageType.VIDEO_REVIEW:
        this.video_review = message;
        break;
    }
  };

  // ============================================================================
  // Dispatcher
  // ============================================================================

  /**
   * Dispatcher - routes incoming MQTT messages to callbacks
   */
  OPP2.Dispatcher = function() {
    this.callbacks = {};
    this.systemState = null;
    this.onError = null;
  };

  OPP2.Dispatcher.prototype.setSystemState = function(state) {
    this.systemState = state;
  };

  OPP2.Dispatcher.prototype.on = function(messageType, callback) {
    this.callbacks[messageType] = callback;
  };

  OPP2.Dispatcher.prototype.dispatch = function(mqttTopic, payload) {
    try {
      // Parse topic
      const topic = OPP2.TopicParser.parse(mqttTopic);
      if (!topic) {
        if (this.onError) {
          this.onError('INVALID_TOPIC', mqttTopic, null);
        }
        return false;
      }

      if (topic.message_type === OPP2.MessageType.UNKNOWN) {
        if (this.onError) {
          this.onError('UNKNOWN_MESSAGE_TYPE', mqttTopic, null);
        }
        return false;
      }

      // Deserialize payload
      const message = OPP2.Deserializer.deserialize(topic.message_type, payload);
      if (!message) {
        if (this.onError) {
          this.onError('DESERIALIZE_ERROR', mqttTopic, payload);
        }
        return false;
      }

      // Update system state if attached
      if (this.systemState) {
        this.systemState.piste_id = topic.piste_id;
        this.systemState.update(topic.message_type, message);
      }

      // Call registered callback
      const callback = this.callbacks[topic.message_type];
      if (callback) {
        callback(topic, message);
      }

      return true;
    } catch (e) {
      console.error('Dispatch error:', e);
      if (this.onError) {
        this.onError('EXCEPTION', mqttTopic, e.message);
      }
      return false;
    }
  };

  // ============================================================================
  // Message Serializer (for publishing)
  // ============================================================================

  OPP2.Serializer = {
    /**
     * Serialize a fencers message for publishing
     */
    serializeFencers: function(leftName, leftNation, rightName, rightNation, seq) {
      return JSON.stringify({
        protocol: OPP2.PROTOCOL_ID,
        version: OPP2.PROTOCOL_VERSION,
        seq: seq || 0,
        left: {
          fencer: {
            id: '',
            name: leftName || '',
            nation: leftNation || ''
          }
        },
        right: {
          fencer: {
            id: '',
            name: rightName || '',
            nation: rightNation || ''
          }
        }
      });
    },

    /**
     * Serialize a control message for publishing
     */
    serializeControl: function(command, side, duration, seq) {
      const msg = {
        protocol: OPP2.PROTOCOL_ID,
        version: OPP2.PROTOCOL_VERSION,
        seq: seq || 0,
        ts: Date.now(),
        command: command
      };

      if (side && side !== OPP2.Side.NONE) {
        msg.side = side;
      }

      if (duration !== undefined && duration > 0) {
        msg.duration = duration;
      }

      return JSON.stringify(msg);
    }
  };

  // Export to global scope
  global.OPP2 = OPP2;

})(typeof window !== 'undefined' ? window : global);
