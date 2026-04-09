const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

// Discovery Content Controllers
const discoveryContentController = {
  // Get all discovery content (from banner_items)
  getAll: async (req, res) => {
    try {
      const { category, status } = req.query;
      
      // Map frontend category names to database names
      const categoryMap = {
        'WhatsNew': "What's New",
        'TopTreks': 'Top Treks',
        'TrekShorts': 'Trek Shorts',
        'TrekForecast': 'Trek Forecast',
        'HomeThemes': 'Home Themes'
      };
      
      let query = `
        SELECT 
          bi.id,
          bi.banner_type_id,
          bt.name as category,
          bi.title,
          bi.subtitle,
          bi.description,
          bi.description_main,
          bi.sub_description,
          bi.icon_url,
          bi.img_url as image_url,
          bi.background_type,
          bi.text_color,
          bi.text_alignment,
          bi.primary_color,
          bi.secondary_color,
          bi.background_image,
          bi.button_text as cta_text,
          bi.link_url as cta_link,
          bi.priority as display_order,
          bi.status,
          bi.start_date,
          bi.end_date,
          bi.created_at,
          bi.updated_at
        FROM banner_items bi
        JOIN banner_types bt ON bi.banner_type_id = bt.id
        WHERE 1=1
      `;
      const params = [];

      if (category) {
        // Convert frontend category to database category
        const dbCategory = categoryMap[category] || category;
        query += ' AND bt.name = ?';
        params.push(dbCategory);
      }

      if (status) {
        query += ' AND bi.status = ?';
        params.push(status);
      }

      query += ' ORDER BY bi.priority ASC, bi.created_at DESC';

      const [rows] = await db.query(query, params);
      
      // Convert category back to frontend format
      const mappedRows = rows.map(row => ({
        id: row.id,
        title: row.title,
        shortCaption: row.subtitle || '',
        longDescription: row.description || '',
        coverImage: row.image_url,  // Map img_url to coverImage
        bannerImage: row.background_image || row.image_url,
        thumbnailImage: row.image_url,
        ctaText: row.cta_text || '',
        ctaLink: row.cta_link || '',
        status: row.status.charAt(0).toUpperCase() + row.status.slice(1),  // Capitalize status
        publishStart: row.start_date || '',
        publishEnd: row.end_date || '',
        visibility: true,
        priorityOrder: row.display_order || 0,
        category: Object.keys(categoryMap).find(key => categoryMap[key] === row.category) || row.category,
        imageDimensions: {
          coverWidth: 400,
          coverHeight: 300,
          bannerWidth: 800,
          bannerHeight: 400
        },
        cardStyle: {
          backgroundColor: row.primary_color || '#FFFFFF',
          textColor: row.text_color || '#000000',
          accentColor: row.secondary_color || '#3b82f6',
          borderRadius: 16
        }
      }));
      
      res.json(mappedRows);
    } catch (error) {
      console.error('Error fetching discovery content:', error);
      res.status(500).json({ error: 'Failed to fetch discovery content' });
    }
  },

  // Get single discovery content
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const [rows] = await db.query(`
        SELECT 
          bi.id,
          bi.banner_type_id,
          bt.name as category,
          bi.title,
          bi.subtitle,
          bi.description,
          bi.img_url as image_url,
          bi.button_text as cta_text,
          bi.link_url as cta_link,
          bi.priority as display_order,
          bi.status
        FROM banner_items bi
        JOIN banner_types bt ON bi.banner_type_id = bt.id
        WHERE bi.id = ?
      `, [id]);
      
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Discovery content not found' });
      }

      // Transform response
      const item = {
        id: rows[0].id,
        title: rows[0].title,
        shortCaption: rows[0].subtitle || '',
        longDescription: rows[0].description || '',
        coverImage: rows[0].image_url,
        ctaText: rows[0].cta_text || '',
        ctaLink: rows[0].cta_link || '',
        status: rows[0].status.charAt(0).toUpperCase() + rows[0].status.slice(1),
        priorityOrder: rows[0].display_order || 0,
        category: rows[0].category
      };

      res.json(item);
    } catch (error) {
      console.error('Error fetching discovery content:', error);
      res.status(500).json({ error: 'Failed to fetch discovery content' });
    }
  },

  // Create discovery content
  create: async (req, res) => {
    try {
      const {
        category,
        title,
        subtitle,
        description,
        image_url,
        cta_text,
        cta_link,
        display_order,
        status
      } = req.body;

      // Map frontend category to database category
      const categoryMap = {
        'WhatsNew': "What's New",
        'TopTreks': 'Top Treks',
        'TrekShorts': 'Trek Shorts'
      };
      const dbCategory = categoryMap[category] || category;

      // Get banner_type_id for the category
      const [typeRows] = await db.query('SELECT id FROM banner_types WHERE name = ?', [dbCategory]);
      
      if (typeRows.length === 0) {
        return res.status(400).json({ error: 'Invalid category' });
      }

      const banner_type_id = typeRows[0].id;

      // Insert into banner_items
      const [result] = await db.query(
        `INSERT INTO banner_items 
        (banner_type_id, title, subtitle, description, img_url, button_text, link_url, priority, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [banner_type_id, title, subtitle, description, image_url, cta_text, cta_link, display_order || 0, (status || 'draft').toLowerCase()]
      );

      res.status(201).json({ message: 'Discovery content created successfully', id: result.insertId });
    } catch (error) {
      console.error('Error creating discovery content:', error);
      res.status(500).json({ error: 'Failed to create discovery content' });
    }
  },

  // Update discovery content
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const {
        title,
        subtitle,
        description,
        image_url,
        cta_text,
        cta_link,
        display_order,
        status
      } = req.body;

      const [result] = await db.query(
        `UPDATE banner_items 
        SET title = ?, subtitle = ?, description = ?, 
            img_url = ?, button_text = ?, link_url = ?, priority = ?, status = ?, updated_at = NOW()
        WHERE id = ?`,
        [title, subtitle, description, image_url, cta_text, cta_link, display_order, (status || 'draft').toLowerCase(), id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Discovery content not found' });
      }

      res.json({ message: 'Discovery content updated successfully' });
    } catch (error) {
      console.error('Error updating discovery content:', error);
      res.status(500).json({ error: 'Failed to update discovery content' });
    }
  },

  // Delete discovery content
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      const [result] = await db.query('DELETE FROM banner_items WHERE id = ?', [id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Discovery content not found' });
      }

      res.json({ message: 'Discovery content deleted successfully' });
    } catch (error) {
      console.error('Error deleting discovery content:', error);
      res.status(500).json({ error: 'Failed to delete discovery content' });
    }
  }
};

// Home Themes Controllers
const homeThemesController = {
  // Get all home themes
  getAll: async (req, res) => {
    try {
      const { type, status } = req.query;
      let query = 'SELECT * FROM home_themes WHERE 1=1';
      const params = [];

      if (type) {
        query += ' AND type = ?';
        params.push(type);
      }

      if (status) {
        query += ' AND status = ?';
        params.push(status);
      }

      query += ' ORDER BY display_order ASC, created_at DESC';

      const [rows] = await db.query(query, params);
      
      // Transform to match frontend structure
      const themes = rows.map(theme => ({
        id: theme.id,
        name: theme.title,
        type: theme.type,
        priority: theme.display_order,
        status: theme.status.charAt(0).toUpperCase() + theme.status.slice(1),  // Capitalize status
        startDate: theme.start_date,
        endDate: theme.end_date,
        lastUpdated: theme.updated_at,
        config: {
          headerBgType: 'Color',
          headerBgValue: theme.background_color || '#ffffff',
          accentColor: theme.text_color || '#3b82f6',
          heroImage: theme.background_image || '',
          dividerStyle: 'Straight',
          animatedOverlay: false
        },
        trek_ids: theme.trek_ids ? JSON.parse(theme.trek_ids) : []
      }));

      res.json(themes);
    } catch (error) {
      console.error('Error fetching home themes:', error);
      res.status(500).json({ error: 'Failed to fetch home themes' });
    }
  },

  // Get single home theme
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const [rows] = await db.query('SELECT * FROM home_themes WHERE id = ?', [id]);
      
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Home theme not found' });
      }

      const theme = {
        id: rows[0].id,
        name: rows[0].title,
        type: rows[0].type,
        priority: rows[0].display_order,
        status: rows[0].status,
        startDate: rows[0].start_date,
        endDate: rows[0].end_date,
        lastUpdated: rows[0].updated_at,
        config: {
          headerBgType: 'Color',
          headerBgValue: rows[0].background_color || '#ffffff',
          accentColor: rows[0].text_color || '#3b82f6',
          heroImage: rows[0].background_image || '',
          dividerStyle: 'Straight',
          animatedOverlay: false
        },
        trek_ids: rows[0].trek_ids ? JSON.parse(rows[0].trek_ids) : []
      };

      res.json(theme);
    } catch (error) {
      console.error('Error fetching home theme:', error);
      res.status(500).json({ error: 'Failed to fetch home theme' });
    }
  },

  // Create home theme
  create: async (req, res) => {
    try {
      const {
        type,
        title,
        subtitle,
        description,
        background_image,
        background_color,
        text_color,
        trek_ids,
        display_order,
        status,
        start_date,
        end_date
      } = req.body;

      const id = uuidv4();
      const trekIdsJson = trek_ids ? JSON.stringify(trek_ids) : null;

      await db.query(
        `INSERT INTO home_themes 
        (id, type, title, subtitle, description, background_image, background_color, 
         text_color, trek_ids, display_order, status, start_date, end_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, type, title, subtitle, description, background_image, background_color, 
         text_color, trekIdsJson, display_order || 0, status || 'draft', start_date, end_date]
      );

      res.status(201).json({ message: 'Home theme created successfully', id });
    } catch (error) {
      console.error('Error creating home theme:', error);
      res.status(500).json({ error: 'Failed to create home theme' });
    }
  },

  // Update home theme
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const {
        type,
        title,
        subtitle,
        description,
        background_image,
        background_color,
        text_color,
        trek_ids,
        display_order,
        status,
        start_date,
        end_date
      } = req.body;

      const trekIdsJson = trek_ids ? JSON.stringify(trek_ids) : null;

      const [result] = await db.query(
        `UPDATE home_themes 
        SET type = ?, title = ?, subtitle = ?, description = ?, 
            background_image = ?, background_color = ?, text_color = ?, 
            trek_ids = ?, display_order = ?, status = ?, start_date = ?, end_date = ?
        WHERE id = ?`,
        [type, title, subtitle, description, background_image, background_color, 
         text_color, trekIdsJson, display_order, status, start_date, end_date, id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Home theme not found' });
      }

      res.json({ message: 'Home theme updated successfully' });
    } catch (error) {
      console.error('Error updating home theme:', error);
      res.status(500).json({ error: 'Failed to update home theme' });
    }
  },

  // Delete home theme
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      const [result] = await db.query('DELETE FROM home_themes WHERE id = ?', [id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Home theme not found' });
      }

      res.json({ message: 'Home theme deleted successfully' });
    } catch (error) {
      console.error('Error deleting home theme:', error);
      res.status(500).json({ error: 'Failed to delete home theme' });
    }
  }
};

// Trek Forecasts Controllers
const trekForecastsController = {
  // Get all trek forecasts
  getAll: async (req, res) => {
    try {
      const { season, status, trek_id } = req.query;
      let query = 'SELECT * FROM trek_forecasts WHERE 1=1';
      const params = [];

      if (season) {
        query += ' AND season = ?';
        params.push(season);
      }

      if (status) {
        query += ' AND status = ?';
        params.push(status);
      }

      if (trek_id) {
        query += ' AND trek_id = ?';
        params.push(trek_id);
      }

      query += ' ORDER BY display_order ASC, created_at DESC';

      const [rows] = await db.query(query, params);
      
      // Transform to match frontend structure
      const forecasts = rows.map(row => ({
        id: row.id,
        destination: row.title,
        region: row.description || '',
        startDate: row.valid_from,
        endDate: row.valid_to,
        weatherSummary: row.weather_info || '',
        safetyAdvisory: row.description || '',
        packingTips: [],
        season: row.season,
        seasonIcon: row.season === 'Winter' ? 'snowflake' : row.season === 'Summer' ? 'sun' : row.season === 'Monsoon' ? 'cloud-rain' : 'leaf',
        status: row.status.charAt(0).toUpperCase() + row.status.slice(1),  // Capitalize status
        forecastImage: row.image_url,
        iconImage: row.image_url,
        containerStyle: {
          width: 85,
          borderRadius: 20,
          backgroundColor: '#FFFFFF'
        },
        imageDimensions: {
          forecastWidth: 35,
          forecastHeight: 16,
          borderRadius: 10,
          iconWidth: 2.5,
          iconHeight: 2.5
        },
        textStyles: {
          titleFontSize: 11,
          normalFontSize: 9
        }
      }));
      
      res.json(forecasts);
    } catch (error) {
      console.error('Error fetching trek forecasts:', error);
      res.status(500).json({ error: 'Failed to fetch trek forecasts' });
    }
  },

  // Get single trek forecast
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const [rows] = await db.query('SELECT * FROM trek_forecasts WHERE id = ?', [id]);
      
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Trek forecast not found' });
      }

      res.json(rows[0]);
    } catch (error) {
      console.error('Error fetching trek forecast:', error);
      res.status(500).json({ error: 'Failed to fetch trek forecast' });
    }
  },

  // Create trek forecast
  create: async (req, res) => {
    try {
      const {
        trek_id,
        season,
        forecast_type,
        title,
        description,
        weather_info,
        difficulty_level,
        best_time,
        expected_bookings,
        price_trend,
        popularity_score,
        image_url,
        display_order,
        status,
        valid_from,
        valid_to
      } = req.body;

      const id = uuidv4();

      await db.query(
        `INSERT INTO trek_forecasts 
        (id, trek_id, season, forecast_type, title, description, weather_info, 
         difficulty_level, best_time, expected_bookings, price_trend, popularity_score, 
         image_url, display_order, status, valid_from, valid_to)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, trek_id, season, forecast_type, title, description, weather_info, 
         difficulty_level, best_time, expected_bookings || 0, price_trend, 
         popularity_score || 0, image_url, display_order || 0, status || 'draft', 
         valid_from, valid_to]
      );

      res.status(201).json({ message: 'Trek forecast created successfully', id });
    } catch (error) {
      console.error('Error creating trek forecast:', error);
      res.status(500).json({ error: 'Failed to create trek forecast' });
    }
  },

  // Update trek forecast
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const {
        trek_id,
        season,
        forecast_type,
        title,
        description,
        weather_info,
        difficulty_level,
        best_time,
        expected_bookings,
        price_trend,
        popularity_score,
        image_url,
        display_order,
        status,
        valid_from,
        valid_to
      } = req.body;

      const [result] = await db.query(
        `UPDATE trek_forecasts 
        SET trek_id = ?, season = ?, forecast_type = ?, title = ?, description = ?, 
            weather_info = ?, difficulty_level = ?, best_time = ?, expected_bookings = ?, 
            price_trend = ?, popularity_score = ?, image_url = ?, display_order = ?, 
            status = ?, valid_from = ?, valid_to = ?
        WHERE id = ?`,
        [trek_id, season, forecast_type, title, description, weather_info, 
         difficulty_level, best_time, expected_bookings, price_trend, popularity_score, 
         image_url, display_order, status, valid_from, valid_to, id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Trek forecast not found' });
      }

      res.json({ message: 'Trek forecast updated successfully' });
    } catch (error) {
      console.error('Error updating trek forecast:', error);
      res.status(500).json({ error: 'Failed to update trek forecast' });
    }
  },

  // Delete trek forecast
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      const [result] = await db.query('DELETE FROM trek_forecasts WHERE id = ?', [id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Trek forecast not found' });
      }

      res.json({ message: 'Trek forecast deleted successfully' });
    } catch (error) {
      console.error('Error deleting trek forecast:', error);
      res.status(500).json({ error: 'Failed to delete trek forecast' });
    }
  }
};

module.exports = {
  discoveryContentController,
  homeThemesController,
  trekForecastsController
};
