# gharchive languages

This repository contains programming language information
from GitHub's API. Every hour of gharchive activity references
a number of repositories and all of those repositores can be 
found in each our of data in this repository.

## About this Data

Hourly collection began on September 27th 2019. From that point
forward, the repos for an hour of activity are collected from the
API in less than 24 hours after the activity. This means that
the langauge data is fairly consistent with the state of the
repository at that time.

All data prior to September 27th 2019 was back filled (a process
that is still ongoing) and is **not** the langauge data the time
the activity took place but is instead from some time after
September 27th.

The languages used in a repository don't shift that much over time
so this old data is still useful in approximating macro trends like
language market share even though the per-repository data is not perfect.
Another factor to consider is that the old the data we are back filling
the more likely a repository is to have been deleted, moved, or renamed
which will give us a null value for the language data in the API.

It's very important when calculating market share about programming
languages to remove this null data from the market share since it
will distort old data more than new data and also because changes in
GitHub's product could effect this as well.

In other words, a null value means "not data available" and not
"cannot determine languages."
