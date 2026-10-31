'use strict';

/**
 * ADAM Bot — lib/db/pdm.js
 * Promote / Demote Messages (PDM) Database Model & Helpers
 * Tracks whether promote/demote notifications are enabled for each group.
 */

const { DataTypes } = require('sequelize');
const config = require('../../config');
const { sequelize } = config;

const PdmDB = sequelize.define('PdmSetting', {
  jid: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  status: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: 'pdm_settings',
  timestamps: false,
});

PdmDB.sync().catch(err => console.error('[ADAM] PDM DB sync error:', err.message));

/**
 * Set PDM status for a group
 * @param {string} jid 
 * @param {string|boolean} status 'on' | 'off' | true | false
 * @returns {Promise<boolean>}
 */
const setPdm = async (jid, status) => {
  const enabled = status === 'on' || status === true;
  const [record] = await PdmDB.findOrCreate({
    where: { jid },
    defaults: { status: enabled },
  });
  record.status = enabled;
  await record.save();
  return record.status;
};

/**
 * Get PDM status for a group
 * @param {string} jid 
 * @returns {Promise<boolean>}
 */
const getPdm = async (jid) => {
  const record = await PdmDB.findOne({ where: { jid } });
  return record ? Boolean(record.status) : false;
};

module.exports = { PdmDB, setPdm, getPdm };
