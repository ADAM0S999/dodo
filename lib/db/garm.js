'use strict';

/**
 * ADAM Bot — lib/db/garm.js
 * Group Accept / Reject Monitor (GARM) Database Model & Helpers
 * Tracks whether join request accept/reject and member add/remove alerts are enabled for each group.
 */

const { DataTypes } = require('sequelize');
const config = require('../../config');
const { sequelize } = config;

const GarmDB = sequelize.define('GarmSetting', {
  jid: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  status: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: 'garm_settings',
  timestamps: false,
});

GarmDB.sync().catch(err => console.error('[ADAM] GARM DB sync error:', err.message));

/**
 * Set GARM status for a group
 * @param {string} jid 
 * @param {string|boolean} status 'on' | 'off' | true | false
 * @returns {Promise<boolean>}
 */
const setGarm = async (jid, status) => {
  const enabled = status === 'on' || status === true;
  const [record] = await GarmDB.findOrCreate({
    where: { jid },
    defaults: { status: enabled },
  });
  record.status = enabled;
  await record.save();
  return record.status;
};

/**
 * Get GARM status for a group
 * @param {string} jid 
 * @returns {Promise<boolean>}
 */
const getGarm = async (jid) => {
  const record = await GarmDB.findOne({ where: { jid } });
  return record ? Boolean(record.status) : false;
};

module.exports = { GarmDB, setGarm, getGarm };
