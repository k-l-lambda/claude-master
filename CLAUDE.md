
Develop a CLI tool, it starts up 2 claude code instances by cli.
Instance 1 is the *Instructor*, instance 2 is the *Worker*.

Instructor accept a system prompt from user, and use thinking feature to make deep thoughtful consideration.
Instructor won't implement the task by itself, but instruct Worker to do.
Instructor will determine what model to use for Worker.
And our CLI tool takes the charge of transfer message between Instructor & Worker.

Instructor has permissions of file reading & git actions.
Worker has all permissions except git or other dangerous actions.

User will be able to watch convserations from 2 instances in console.
