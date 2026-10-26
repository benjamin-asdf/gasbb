(ns gasbb.convert
  "Conversions between Clojure data and the plain JS values Apps Script
  services hand out and accept."
  (:require [clojure.string :as str]))

(defn- js-array? [x] (.isArray js/Array x))

(defn- plain-object? [x]
  (and (some? x)
       (identical? (type x) js/Object)))

(defn ->clj
  "JS -> Clojure. Arrays become vectors, plain objects become keyword maps.
  Dates and Apps Script service objects (Range, Sheet, ...) are kept as is."
  [x]
  (cond
    (js-array? x) (mapv ->clj x)
    (plain-object? x) (into {} (map (fn [k] [(keyword k) (->clj (unchecked-get x k))]))
                            (js-keys x))
    :else x))

(defn ->js
  "Clojure -> JS. Keywords become strings (namespace kept), maps become
  objects, sequential collections and sets become arrays."
  [x]
  (cond
    (keyword? x) (if-let [n (namespace x)] (str n "/" (name x)) (name x))
    (symbol? x) (str x)
    (map? x) (let [o #js {}]
               (doseq [[k v] x] (unchecked-set o (->js k) (->js v)))
               o)
    (or (sequential? x) (set? x)) (into-array (map ->js x))
    :else x))

(defn- cell-scalar [x]
  (cond
    (nil? x) ""
    (or (string? x) (number? x) (boolean? x) (inst? x)) x
    (keyword? x) (->js x)
    (symbol? x) (str x)
    :else (pr-str x)))

(defn- row [x]
  (if (or (sequential? x) (set? x))
    (mapv cell-scalar x)
    [(cell-scalar x)]))

(defn- pad [rows]
  (let [w (reduce max 1 (map count rows))]
    (mapv #(into % (repeat (- w (count %)) "")) rows)))

(defn ->cell
  "Clojure -> a value a custom spreadsheet function may return: a scalar or a
  rectangular 2D array. A flat sequence spills down one column, a sequence
  of sequences fills a range, a map spills as key/value rows."
  [x]
  (cond
    (map? x) (->cell (map (fn [[k v]] [k v]) x))
    (or (sequential? x) (set? x))
    (let [xs (seq x)]
      (if (nil? xs)
        ""
        (->js (pad (if (some #(or (sequential? %) (set? %) (map? %)) xs)
                     (map (fn [r] (if (map? r) (row (vals r)) (row r))) xs)
                     (map vector (map cell-scalar xs)))))))
    :else (cell-scalar x)))

(defn header->key [h]
  (-> (str h) str/trim str/lower-case (str/replace #"[^a-z0-9]+" "-")
      (str/replace #"^-|-$" "") keyword))
