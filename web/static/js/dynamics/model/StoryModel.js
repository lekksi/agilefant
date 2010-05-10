
/**
 * Constructor for the <code>StoryModel</code> class.
 * 
 * @constructor
 * @base CommonModel
 * @see CommonModel#initialize
 */
var StoryModel = function StoryModel() {
  this.initialize();
  this.persistedClassName = "fi.hut.soberit.agilefant.model.Story";
  this.relations = {
    backlog: null,
    project: null,
    task: [],
    hourEntry: [],
    user: [],
    story: [],
    label: [],
    parent: null
  };
  this.metrics = {};
  this.copiedFields = {
    "name": "name",
    "description": "description",
    "state": "state",
    "storyPoints": "storyPoints",
    "rank": "rank"
  };
  this.classNameToRelation = {
      "fi.hut.soberit.agilefant.model.Product":       "backlog",
      "fi.hut.soberit.agilefant.model.Project":       "project",
      "fi.hut.soberit.agilefant.model.Iteration":     "backlog",
      "fi.hut.soberit.agilefant.model.User":          "user",
      "fi.hut.soberit.agilefant.model.Label":         "label",
      "fi.hut.soberit.agilefant.model.Task":          "task",
      "fi.hut.soberit.agilefant.model.StoryHourEntry": "hourEntry",
      "fi.hut.soberit.agilefant.model.Story":         "story"
  };
  this.metricFields = ["storyPoints", "state"];
};

StoryModel.prototype = new CommonModel();

StoryModel.Validators = {
  backlogValidator: function(model) {
    if (!model.getBacklog()) {
      throw "Please select a parent backlog";
    }
  }
};

/**
 * Internal function to parse data.
 * @throws {String "Invalid data"} if data is invalid
 */
StoryModel.prototype._setData = function(newData) { 
  // Set the id
  this.id = newData.id;
    /*
  //set the rank by hand if it exists in the data
  if(newData.rank !== undefined && newData.rank !== null) {
    this.setRank(newData.rank);
  }
  */
  // Set the tasks
  if (newData.tasks) {
    this._updateRelations(ModelFactory.types.task, newData.tasks);
  }
  
  if(newData.responsibles) {
    this._updateRelations(ModelFactory.types.user, newData.responsibles);
  }
  if(newData.children) {
    this._updateRelations(ModelFactory.types.story, newData.children);
  }
  if(newData.parent) {
    this.relations.parent = ModelFactory.updateObject(newData.parent, true);
  }
  if(newData.backlog) {
    this.setBacklog(ModelFactory.updateObject(newData.backlog, true));
  }
  if (newData.labels) {
    this._updateRelations(ModelFactory.types.label, newData.labels);
  }
  if(newData.metrics) {
    this.metrics = newData.metrics;
  }
};

/**
 * Internal function to send the data to server.
 */
StoryModel.prototype._saveData = function(id, changedData) {
  var me = this;
  
  var url = "ajax/storeStory.action";
  var data = {};
  
  if (changedData.usersChanged) {
    jQuery.extend(data, {userIds: changedData.userIds, usersChanged: true});
    delete changedData.userIds;
    delete changedData.usersChanged;
  }
  jQuery.extend(data, this.serializeFields("story", changedData));
  if(ArrayUtils.countObjectFields(data) === 0) {
    return;
  }
  // Add the id
  if (id) {
    data.storyId = id;    
  }
  else {
    url = "ajax/createStory.action";
    data.backlogId = this.getBacklog().getId();
  }
  

  
  jQuery.ajax({
    type: "POST",
    url: url,
    async: true,
    cache: false,
    data: data,
    dataType: "json",
    success: function(data, status) {
      MessageDisplay.Ok("Story saved successfully");
      var object = ModelFactory.updateObject(data);
      
      if(!id) {
        me.getBacklog().addStory(object);
        object.callListeners(new DynamicsEvents.AddEvent(object));
      }
      if (me.relations.backlog) {
        //me.relations.backlog.reload();
      }
    },
    error: function(xhr, status, error) {
      MessageDisplay.Error("Error saving story", xhr);
    }
  });
};

StoryModel.prototype.reload = function(callback) {
  var me = this;
  jQuery.getJSON(
    "ajax/retrieveStory.action",
    {storyId: me.getId()},
    function(data,status) {
      me.setData(data);
      //me.callListeners(new DynamicsEvents.EditEvent(me));
      if (callback) {
        callback();
      }
    }
  );
};

StoryModel.prototype.reloadMetrics = function() {
  var me = this;
  jQuery.getJSON(
    "ajax/retrieveStoryMetrics.action",
    {storyId: me.getId()},
    function(data,status) {
      me.setData(data);
      me.callListeners(new DynamicsEvents.EditEvent(me));
    }
  );
};

StoryModel.prototype.moveStory = function(backlogId) {
  var me = this;
  var oldBacklog = this.relations.backlog;
  var oldProject = this.relations.project;
  
  jQuery.ajax({
    url: "ajax/moveStory.action",
    data: {storyId: me.getId(), backlogId: backlogId},
    dataType: 'json',
    type: 'post',
    async: true,
    cache: false,
    success: function(data,status) {
      me.relations.backlog = null;
      me.relations.project = null;
      me._setData(data);
      
      //remove unneccesary old backlog relations
      if (oldProject && oldProject !== me.relations.project) {
        oldProject.removeStory(me);
        //LEAF STORIES: moved to another project
        oldProject.reloadStoryRanks();
      }
      if (oldBacklog && oldBacklog !== me.relations.backlog) {        
        oldBacklog.removeStory(me);
      }
     
      me.callListeners(new DynamicsEvents.EditEvent(me));
      MessageDisplay.Ok("Story moved");
    },
    error: function(xhr) {
      MessageDisplay.Error("An error occurred moving the story", xhr);
    }
  });
};

StoryModel.prototype.rankUnder = function(rankUnderId, moveUnder) {
  this._rank("under", rankUnderId, moveUnder);
};

StoryModel.prototype.rankOver = function(rankOverId, moveUnder) {
  this._rank("over", rankOverId, moveUnder);
};

StoryModel.prototype._rank = function(direction, targetStoryId, targetBacklog) {
  var me = this;
  var postData = {
    "storyId": me.getId(),
    "targetStoryId": targetStoryId
  };
  
  if (targetBacklog && targetBacklog != this.getParent()) {
    postData.backlogId = targetBacklog.getId();
  }
  
  var urls = {
    "over": "ajax/rankStoryOver.action",
    "under": "ajax/rankStoryUnder.action"
  };
  
  jQuery.ajax({
    url: urls[direction],
    type: "post",
    dataType: "json",
    data: postData,
    async: true,
    cache: false,
    success: function(data, status) {
      MessageDisplay.Ok("Story ranked");
      var oldParent = me.getParent();
      me.setData(data);
      //and again hack!
      if(me.relations.project) {
        //the story is being ranked in the project context in which the stories may have different parent backlogs
        me.relations.project.callListeners(new DynamicsEvents.RankChanged(me.relations.project,"story"));
      } else {
        oldParent.callListeners(new DynamicsEvents.RankChanged(oldParent,"story"));
        if (oldParent !== targetBacklog) {
          targetBacklog.callListeners(new DynamicsEvents.RankChanged(targetBacklog,"story"));
        }
      }
    },
    error: function(xhr) {
      MessageDisplay.Error("An error occurred while ranking the story", xhr);
    }
  });
};


StoryModel.prototype._remove = function(successCallback, extraData) {
  var me = this;
  var data = {
      storyId: me.getId()
  };
  jQuery.extend(data, extraData);
  jQuery.ajax({
      type: "POST",
      dataType: "text",
      url: "ajax/deleteStory.action",
      data: data,
      async: true,
      cache: false,
      success: function(data, status) {
        MessageDisplay.Ok("Story removed");
        if (successCallback) {
          successCallback();
        }
      },
      error: function(data, status) {
        MessageDisplay.Error("Error deleting story.", data);
      }
  });
};

StoryModel.prototype.addTask = function(task) {
  this.addRelation(task);
  this.callListeners(new DynamicsEvents.RelationUpdatedEvent(this,"task"));
};



// Getters and setters in property alphabetical order
StoryModel.prototype.getBacklog = function() {
  //hack! in case of leaf stories story may have multiple backlogs
  if(this.relations.project && !this.relations.backlog) {
    return this.relations.project;
  }
  return this.relations.backlog;
};
StoryModel.prototype.setBacklog = function(backlog) {
  this.addRelation(backlog);
};

StoryModel.prototype.setBacklogByModel = function(backlog) {
  this.setBacklog(backlog);
  this.currentData.backlog = backlog.getId();
};

StoryModel.prototype.setBacklogById = function(backlogId) {
  this.setBacklog(ModelFactory.getOrRetrieveObject(ModelFactory.types.backlog, backlogId));
  this.currentData.backlogId = backlogId;
};


StoryModel.prototype.getDescription = function() {
  return this.currentData.description;
};
StoryModel.prototype.setDescription = function(description) {
  this.currentData.description = description;
};

StoryModel.prototype.getName = function() {
  return this.currentData.name;
};
StoryModel.prototype.setName = function(name) {
  this.currentData.name = name;
};

StoryModel.prototype.getParent = function() {
  return this.getBacklog();
};


StoryModel.prototype.getRank = function() {
  return this.currentData.rank;
};
StoryModel.prototype.setRank = function(newRank) {
  this.currentData.rank = newRank;
};


StoryModel.prototype.getResponsibles = function() {
  if (this.currentData.userIds) {
    var users = [];
    $.each(this.currentData.userIds, function(k, id) {
      users.push(ModelFactory.getObject(ModelFactory.types.user, id));
    });
    return users;
  }
  return this.relations.user;
};
StoryModel.prototype.setResponsibles = function(userIds, userJson) {
  if (userJson) {
    $.each(userJson, function(k,v) {
      ModelFactory.updateObject(v);    
    });
  }
  this.currentData.userIds = userIds;
  this.currentData.usersChanged = true;
};


StoryModel.prototype.getState = function() {
  return this.currentData.state;
};
StoryModel.prototype.setState = function(state) {
  this.currentData.state = state;
};


StoryModel.prototype.getStoryPoints = function() {
  return this.currentData.storyPoints;
};
StoryModel.prototype.setStoryPoints = function(storyPoints) {
  this.currentData.storyPoints = storyPoints;
};


StoryModel.prototype.getTasks = function() {
  return this.relations.task;
};

StoryModel.prototype.getChildren = function() {
  return this.relations.story;
};
StoryModel.prototype.getParentStory = function() {
  return this.relations.parent;
};
StoryModel.prototype.getParentStoryName = function() {
  var parentName = "";
  if(this.relations.parent) {
    parentName = this.relations.parent.getName();
  }
  return parentName;
};

StoryModel.prototype.getTotalEffortSpent = function() {
  return this.metrics.effortSpent;
};
StoryModel.prototype.getTotalEffortLeft = function() {
  return this.metrics.effortLeft;
};
StoryModel.prototype.getTotalOriginalEstimate = function() {
  return this.metrics.originalEstimate;
};

StoryModel.prototype.getLabels = function() {
  return this.relations.label;
};


