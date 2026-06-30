-- Safety cleanup: remove any remaining legacy project_type = 'task' (superseded by aim in 013)

UPDATE projects SET project_type = 'aim' WHERE project_type = 'task';
